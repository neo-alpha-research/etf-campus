CREATE TABLE IF NOT EXISTS style_diagnosis_results (
  id TEXT PRIMARY KEY,
  style_id TEXT NOT NULL,
  book_slug TEXT NOT NULL,
  axis_view REAL NOT NULL,
  axis_range REAL NOT NULL,
  axis_timing REAL NOT NULL,
  axis_criteria REAL NOT NULL,
  axis_depth REAL NOT NULL,
  need_signal INTEGER NOT NULL,
  need_map INTEGER NOT NULL,
  need_income INTEGER NOT NULL,
  completed_date TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (DATETIME('now'))
);

CREATE INDEX IF NOT EXISTS idx_style_results_style ON style_diagnosis_results (style_id);
CREATE INDEX IF NOT EXISTS idx_style_results_date ON style_diagnosis_results (completed_date);
