# Cut a podcast moment into a vertical social clip

Audience: Listeners scrolling a feed

Inputs: A recording and word timestamps (clearframe ingest --audio), one self-contained moment of 30–60 s

Import the real recording with clearframe ingest --audio episode.wav --words words.json --from START --to END --vertical. Every beat then plays its exact slice of the recording; keep the words as captions where they carry the moment, and give the rest pictures.
