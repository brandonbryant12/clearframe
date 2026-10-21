//! Numbers as viewers read them: locale-independent grouping, a true minus sign, and an
//! atomic sign/prefix/digits/suffix string, shared by every block and native layer.

/// Locale-independent grouping; the sign, prefix, digits and suffix stay one atomic string.
pub fn format_number(value: f64, decimals: usize, prefix: &str, suffix: &str) -> String {
    let (sign, digits) = number_parts(value, decimals);
    format!("{sign}{prefix}{digits}{suffix}")
}
/// ("−" or "", grouped digits with fraction), rounding negative zero away.
pub fn number_parts(value: f64, decimals: usize) -> (&'static str, String) {
    let decimals = decimals.min(8);
    let threshold = 0.5 * 10_f64.powi(-(decimals as i32));
    let value = if value.abs() < threshold { 0.0 } else { value };
    let raw = format!("{:.*}", decimals, value.abs());
    let mut parts = raw.split('.');
    let integer = parts.next().unwrap_or("0");
    let mut grouped = String::new();
    for (i, c) in integer.chars().enumerate() {
        if i > 0 && (integer.len() - i) % 3 == 0 {
            grouped.push(',');
        }
        grouped.push(c);
    }
    if let Some(fraction) = parts.next() {
        grouped.push('.');
        grouped.push_str(fraction);
    }
    (if value < 0.0 { "−" } else { "" }, grouped)
}
pub fn zero_scale(value: f64, max: f64) -> f64 {
    if max <= 0.0 { 0.0 } else { (value / max).clamp(0.0, 1.0) }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn signed_suffixes_are_atomic() {
        assert_eq!(format_number(-1234.5, 1, "$", " million"), "−$1,234.5 million");
        assert_eq!(format_number(-0.0001, 2, "", "%"), "0.00%");
        assert_eq!(format_number(1e7, 0, "", ""), "10,000,000");
    }
    #[test]
    fn bars_have_truthful_zero_baselines() {
        assert_eq!(zero_scale(0.0, 50.0), 0.0);
        assert_eq!(zero_scale(25.0, 50.0), 0.5);
        assert_eq!(zero_scale(0.0, 0.0), 0.0);
    }
}
