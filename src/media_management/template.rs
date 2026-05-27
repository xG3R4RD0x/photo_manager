use chrono::{NaiveDateTime, Datelike};

pub fn apply_template(template: &str, dt: NaiveDateTime) -> String {
    let mut result = template.to_string();

    // Longest tokens first to prevent partial matches
    result = result.replace("YYYY-MM-DD", &dt.format("%Y-%m-%d").to_string());
    result = result.replace("YYYYMMDD", &dt.format("%Y%m%d").to_string());
    result = result.replace("MONTH_EN", &dt.format("%B").to_string());
    result = result.replace("MONTH_ES", &spanish_month_name(dt.month()));
    result = result.replace("MONTH", &dt.format("%B").to_string());

    result = result.replace("YYYY", &dt.format("%Y").to_string());
    result = result.replace("YY", &dt.format("%y").to_string());
    result = result.replace("MM", &dt.format("%m").to_string());
    result = result.replace("DD", &dt.format("%d").to_string());
    result = result.replace("HH", &dt.format("%H").to_string());
    result = result.replace("mm", &dt.format("%M").to_string());
    result = result.replace("ss", &dt.format("%S").to_string());

    result
}

fn spanish_month_name(month: u32) -> &'static str {
    match month {
        1 => "Enero",
        2 => "Febrero",
        3 => "Marzo",
        4 => "Abril",
        5 => "Mayo",
        6 => "Junio",
        7 => "Julio",
        8 => "Agosto",
        9 => "Septiembre",
        10 => "Octubre",
        11 => "Noviembre",
        12 => "Diciembre",
        _ => "Desconocido",
    }
}
