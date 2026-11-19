//! Inspect the same validated subtitle data that an fframes video can consume.
use fframes::media::subtitles::{CaptionTrack, WordState};
use serde_json::{Value, json};

pub fn inspect(source: &str, at: Option<f64>) -> Result<Value, String> {
    let track = CaptionTrack::parse(source).map_err(|e| e.to_string())?;
    let Some(at) = at else {
        return Ok(json!({ "cues": track.cues() }));
    };
    if !at.is_finite() || at < 0.0 {
        return Err("caption time must be finite and nonnegative".into());
    }
    let active: Vec<_> = track
        .active_cues(at)
        .map(|(index, cue)| {
            let words: Vec<_> = cue
                .words
                .iter()
                .enumerate()
                .filter(|(_, word)| word.state_at(at) == WordState::Active)
                .map(|(i, word)| json!({ "index": i, "text": word.text, "progress": word.progress_at(at) }))
                .collect();
            json!({ "index": index, "cue": cue, "activeWords": words })
        })
        .collect();
    Ok(json!({ "at": at, "active": active }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lookup_preserves_gaps_overlaps_and_phrase_only_tracks() {
        let source = r#"{"cues":[{"start":0.0,"end":2.0,"words":[{"text":"wait","start":0.0,"end":0.5},{"text":"go","start":1.0,"end":1.5}]},{"start":1.0,"end":2.0,"text":"other speaker"}]}"#;
        assert_eq!(inspect(source, Some(0.5)).unwrap()["active"][0]["activeWords"], json!([]));
        let sample = inspect(source, Some(1.25)).unwrap();
        assert_eq!(sample["active"].as_array().unwrap().len(), 2);
        assert_eq!(sample["active"][0]["activeWords"][0]["progress"], 0.5);
        assert_eq!(sample["active"][1]["activeWords"], json!([]));
        assert_eq!(inspect(source, Some(2.0)).unwrap()["active"], json!([]));
        let vtt = "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nA phrase\n";
        assert_eq!(inspect(vtt, Some(1.0)).unwrap()["active"][0]["activeWords"], json!([]));
        assert!(inspect("{}", None).is_err());
    }
}
