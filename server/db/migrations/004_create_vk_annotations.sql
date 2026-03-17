-- Annotations for the conversion rate chart (notes per time period)
CREATE TABLE IF NOT EXISTS vk_annotations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  period VARCHAR(20) NOT NULL,
  period_type ENUM('week','month') NOT NULL,
  note TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
