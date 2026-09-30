//! Timing constants shared with the Node pipeline (`fframes/constants.json`), compiled in so
//! scheduling in `production` and drawing here can never disagree.
use serde::Deserialize;
use std::collections::HashMap;
use std::sync::OnceLock;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanvasTiming {
    pub draw: f32,
    pub scramble: f32,
    pub grow: f32,
    pub key: f32,
    pub along: f32,
    pub count: f32,
    pub type_per_char: f32,
    pub type_min: f32,
    pub type_max: f32,
}

#[derive(Deserialize)]
pub struct Constants {
    pub entrance: HashMap<String, f32>,
    pub stagger: HashMap<String, f32>,
    pub cover: HashMap<String, [f32; 2]>,
    pub canvas: CanvasTiming,
}

pub fn get() -> &'static Constants {
    static CONSTANTS: OnceLock<Constants> = OnceLock::new();
    CONSTANTS.get_or_init(|| {
        serde_json::from_str(include_str!("../../constants.json")).expect("fframes/constants.json is valid")
    })
}
