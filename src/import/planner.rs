use std::path::PathBuf;
use std::collections::BTreeMap;
use chrono::NaiveDateTime;
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TreeNode {
    pub name: String,
    pub count: usize,
    pub is_new: bool, // folder doesn't exist yet
    pub children: Vec<TreeNode>,
}

/// Group photos by month > day for grid display
pub fn group_photos_by_date(photos: &[(PathBuf, Option<NaiveDateTime>)]) -> Vec<(String, Vec<(String, Vec<PathBuf>)>)> {
    let mut by_month: BTreeMap<String, BTreeMap<String, Vec<PathBuf>>> = BTreeMap::new();
    
    for (path, date_opt) in photos {
        let month_key = match date_opt {
            Some(dt) => format!("{}", dt.format("%Y-%m")),
            None => "0000-00".to_string(), // For sorting, Sin fecha goes last
        };
        
        let day_key = match date_opt {
            Some(dt) => format!("{}", dt.format("%Y-%m-%d")),
            None => "Sin fecha".to_string(),
        };
        
        by_month
            .entry(month_key)
            .or_default()
            .entry(day_key)
            .or_default()
            .push(path.clone());
    }
    
    // Reverse sort to get newest first
    let mut result: Vec<_> = by_month
        .into_iter()
        .map(|(month, days)| {
            let day_groups: Vec<_> = days
                .into_iter()
                .map(|(day, paths)| (day, paths))
                .collect();
            (month, day_groups)
        })
        .collect();
    
    result.reverse();
    result
}

/// Build destination tree preview based on template + selected photos
pub fn build_destination_tree(
    root: &str,
    photos: &[(PathBuf, Option<NaiveDateTime>)],
    template: &str,
) -> TreeNode {
    let mut tree: BTreeMap<String, BTreeMap<String, usize>> = BTreeMap::new();
    
    for (_path, date_opt) in photos {
        let folder_path = match date_opt {
            Some(dt) => apply_template(template, *dt),
            None => "SinFecha".to_string(),
        };
        
        // Parse folder_path into nested structure
        let parts: Vec<&str> = folder_path.split('/').filter(|s| !s.is_empty()).collect();
        
        let current = &mut tree;
        for (i, part) in parts.iter().enumerate() {
            if i == parts.len() - 1 {
                current.entry(part.to_string())
                    .or_default()
                    .entry("__COUNT__".to_string())
                    .and_modify(|c| *c += 1)
                    .or_insert(1);
            } else {
                // We need recursive logic here, simplified for now
                current.entry(part.to_string()).or_default();
            }
        }
    }
    
    // Simplified: build flat tree
    let mut children = Vec::new();
    for (folder, contents) in tree.iter() {
        let count = contents.get("__COUNT__").copied().unwrap_or(0);
        children.push(TreeNode {
            name: folder.clone(),
            count,
            is_new: true, // TODO: check if folder exists
            children: vec![],
        });
    }
    
    TreeNode {
        name: root.to_string(),
        count: children.iter().map(|c| c.count).sum(),
        is_new: false,
        children,
    }
}

/// Apply template string to date (delegates to shared implementation)
fn apply_template(template: &str, dt: chrono::NaiveDateTime) -> String {
    crate::media_management::template::apply_template(template, dt)
}
