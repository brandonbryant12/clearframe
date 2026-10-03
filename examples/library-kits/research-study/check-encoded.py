"""Bounded pixel checks against independently mapped source observations.

Streams one 720px decoded frame at a time, with two FFmpeg workers. No image libraries.
Native geometry and encoded pixels have separate tolerances; neither proves arbitrary
future inputs. Run after verify.mjs, through the shared heavy gate.
"""
import datetime
import hashlib
import json
import math
import pathlib
import subprocess

ROOT = pathlib.Path(__file__).resolve().parent
RUNS = json.loads((ROOT / "build/verification.json").read_text())


def value(v, kind):
    if kind == "date":
        return datetime.date.fromisoformat(v).toordinal()
    return float(v)


def fraction(v, axis):
    low, high = [value(x, axis["type"]) for x in axis["domain"]]
    v = value(v, axis["type"])
    if axis["type"] == "log":
        low, high, v = [math.log10(x) for x in (low, high, v)]
    return (v - low) / (high - low)


def is_color(rgb, offset, series):
    r, g, b = rgb[offset:offset + 3]
    if series == 0:
        return max(r, g, b) < 90 and max(r, g, b)-min(r, g, b) < 30
    return r - b > 48 and r - g > 25


def has_mark(rgb, x, y, width, height, series, radius=3):
    # Tolerance covers scaling, observation radius, antialiasing and H.264 chroma.
    for yy in range(max(0, round(y)-radius), min(height, round(y)+radius+1)):
        for xx in range(max(0, round(x)-radius), min(width, round(x)+radius+1)):
            if is_color(rgb, (yy*width+xx)*3, series):
                return True
    return False


results = []
INPUT = json.loads((ROOT / "source/inputs.json").read_text())
for run in RUNS:
    if run["name"].startswith("gate-"):
        continue
    project = ROOT / run["name"]
    job = json.loads((project / "build/native/job.json").read_text())
    sb = json.loads((project / "storyboard.json").read_text())
    receipt = json.loads((pathlib.Path(run["dir"]) / "video.mp4.json").read_text())
    input_sha = hashlib.sha256((project / "storyboard.json").read_bytes()).hexdigest()
    assert receipt["hashes"]["storyboard.json"] == input_sha, "Stale rendered input"
    width = 720
    scale = width / job["width"]
    height = round(job["height"] * scale)
    mapped = []
    geometry_checks = 0
    for source, beat in zip(sb["beats"], job["beats"]):
        fixture = INPUT[beat["id"]]
        p = {"x":{"type":"date","domain":[fixture["dates"][0],fixture["dates"][-1]],"ticks":[fixture["dates"][0],fixture["dates"][-1]]},
             "y":{"type":"linear","domain":fixture["yDomain"],"ticks":fixture["yTicks"]},
             "series":[{"id":s["id"],"values":[{"x":x,"y":y} for x,y in zip(fixture["dates"],s["values"])]} for s in fixture["series"]],
             "motion":{"at":.5,"duration":4}}
        assert len(p["series"]) == 2, "This audit covers the two-series fixtures only"
        elements = {e.get("id"): e for e in beat["props"]["elements"]}
        grids = [elements[f'{beat["id"]}-plot-y-grid-{i}'] for i in range(len(p["y"]["ticks"]))]
        left, right = grids[0]["x1"], grids[0]["x2"]
        bottom, top = grids[0]["y1"], grids[-1]["y1"]
        points, segments = [], []
        for series, data in enumerate(p["series"]):
            previous = None
            for i, point in enumerate(data["values"]):
                if point["y"] is None:
                    previous = None
                    continue
                x = left + fraction(point["x"], p["x"]) * (right-left)
                y = bottom - fraction(point["y"], p["y"]) * (bottom-top)
                mark = elements[f'{beat["id"]}-plot-{data["id"]}-point-{i}']
                assert abs(x-mark["cx"]) < 1e-7 and abs(y-mark["cy"]) < 1e-7, "Source/native proportion mismatch"
                geometry_checks += 1
                at = 0 if p.get("motion") == "none" else p["motion"]["at"] + p["motion"]["duration"] * fraction(point["x"], p["x"])
                current = {"series":series, "x":x*scale, "y":y*scale, "at":at}
                points.append(current)
                if previous is not None:
                    segments.append((previous, current))
                previous = current
        # Test tick spacing independently too: actual geometry must respect the source scale.
        for tick, grid in zip(p["y"]["ticks"], grids):
            expected = bottom - fraction(tick, p["y"]) * (bottom-top)
            assert abs(grid["y1"]-expected) < 1e-7, "Tick/native scale mismatch"
            geometry_checks += 1
        for i, tick in enumerate(p["x"]["ticks"]):
            actual = elements[f'{beat["id"]}-plot-x-tick-{i}']["x1"]
            expected = left + fraction(tick,p["x"]) * (right-left)
            assert abs(actual-expected) < 1e-7, "Date/numeric x tick mismatch"
            geometry_checks += 1
        if beat["id"] == "interval":
            shade = elements["interval-window"]
            expected_left = left + fraction(fixture["window"][0],p["x"])*(right-left)
            expected_right = left + fraction(fixture["window"][1],p["x"])*(right-left)
            assert abs(shade["x"]-expected_left)<1e-7 and abs(shade["x"]+shade["w"]-expected_right)<1e-7
            assert abs(shade["y"]-top)<1e-7 and abs(shade["h"]-(bottom-top))<1e-7
            geometry_checks += 4
        mapped.append((beat, points, segments, (left*scale,right*scale,top*scale,bottom*scale)))
    command = ["ffmpeg", "-v", "error", "-threads", "2", "-i", str(pathlib.Path(run["dir"])/"video.mp4"),
               "-vf", f"scale={width}:{height}", "-filter_threads", "2", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    size = width*height*3
    frames = observations = skipped_occlusions = front_checks = future_checks = 0
    failures = []
    while True:
        rgb = process.stdout.read(size)
        if not rgb:
            break
        assert len(rgb) == size, "Partial decoded frame"
        frame = frames
        frames += 1
        for beat, points, segments, bounds in mapped:
            if not beat["start_frame"] <= frame < beat["start_frame"] + beat["frames"]:
                continue
            local = (frame-beat["start_frame"]) / job["fps"]
            # Exclude authored whole-scene arrival/departure, but cover every reveal and hold frame.
            if local < .5 or local > beat["frames"]/job["fps"]-.5:
                break
            for point in points:
                if local < point["at"] + .05:
                    continue
                if any(q["series"] != point["series"] and local >= q["at"] and
                       math.hypot(q["x"]-point["x"],q["y"]-point["y"]) < 6 for q in points):
                    skipped_occlusions += 1
                    continue
                observations += 1
                if not has_mark(rgb,point["x"],point["y"],width,height,point["series"]):
                    failures.append({"kind":"observation", "frame":frame, "series":point["series"], "x":point["x"], "y":point["y"]})
            fronts=[]
            for series in (0,1):
                arrived=[q for q in points if q["series"]==series and q["at"]<=local]
                front=max(arrived,key=lambda q:q["x"]) if arrived else None
                for a,b in segments:
                    if a["series"]==series and a["at"]<=local<b["at"]:
                        progress=(local-a["at"])/(b["at"]-a["at"])
                        front={"series":series,"x":a["x"]+(b["x"]-a["x"])*progress,
                               "y":a["y"]+(b["y"]-a["y"])*progress}
                fronts.append(front)
            for series,front in enumerate(fronts):
                if front is None:
                    continue
                other=fronts[1-series]
                if other is None or math.hypot(front["x"]-other["x"],front["y"]-other["y"])>=6:
                    front_checks+=1
                    if not has_mark(rgb,front["x"],front["y"],width,height,series):
                        failures.append({"kind":"reveal-front", "frame":frame,"series":series,"x":front["x"],"y":front["y"]})
                future_x=math.ceil(front["x"]+6)
                if future_x<bounds[1]-3:
                    future_checks+=1
                    if any(is_color(rgb,(y*width+future_x)*3,series) for y in range(math.ceil(bounds[2]),math.floor(bounds[3])+1)):
                        failures.append({"kind":"future-stroke", "frame":frame,"series":series,"x":future_x})
            break
    stderr = process.stderr.read().decode()
    assert process.wait() == 0, stderr
    assert frames == job["frames"], "Missing encoded frames"
    report = {"variant":run["name"], "framesDecoded":frames, "nativeCoordinateChecks":geometry_checks,
              "visibleObservationChecks":observations, "occludedSamplesExcluded":skipped_occlusions,
              "revealFrontChecks":front_checks,"futureColumnChecks":future_checks,
              "failures":len(failures), "firstFailures":failures[:8], "nativeTolerancePx":1e-7,
              "encodedTolerancePx":3, "encodedAuditWidth":width,
              "scope":"Two-series point centers, both-axis ticks and native date-window boundaries; decoded observation positions, shared-clock reveal fronts and absence of future strokes during reveals/holds. Not an area/volume encoding audit or subjective continuous playback."}
    results.append(report)
    print(json.dumps(report), flush=True)
(ROOT/"build/encoded-proportions.json").write_text(json.dumps(results,indent=2)+"\n")
assert not any(r["failures"] for r in results), "Encoded positions differ from source expectations"
