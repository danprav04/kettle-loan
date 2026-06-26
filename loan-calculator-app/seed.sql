BEGIN;

UPDATE rooms SET name = 'Euro Trip ✈️', currency = 'EUR' WHERE id = 1;
UPDATE room_members SET role = 'admin' WHERE room_id = 1 AND user_id = 1;

INSERT INTO users (id, username, password) VALUES
(2, 'bob', '$2b$10$sDjg75WQPWumEWxd4WoGfepleWdZTibf7O2QG8V3AjB9D45hvOnUu'),
(3, 'alice', '$2b$10$sDjg75WQPWumEWxd4WoGfepleWdZTibf7O2QG8V3AjB9D45hvOnUu'),
(4, 'charlie', '$2b$10$sDjg75WQPWumEWxd4WoGfepleWdZTibf7O2QG8V3AjB9D45hvOnUu'),
(5, 'dave', '$2b$10$sDjg75WQPWumEWxd4WoGfepleWdZTibf7O2QG8V3AjB9D45hvOnUu')
ON CONFLICT (id) DO NOTHING;

SELECT pg_catalog.setval('users_id_seq', 5, true);

INSERT INTO room_members (user_id, room_id, role) VALUES
(2, 1, 'active'),
(3, 1, 'active'),
(4, 1, 'passive'),
(5, 1, 'observer')
ON CONFLICT (user_id, room_id) DO UPDATE SET role = EXCLUDED.role;

DELETE FROM entries WHERE room_id = 1;

INSERT INTO entries (id, room_id, user_id, amount, description, split_with_user_ids, payer_shares, beneficiary_shares, created_by_user_id, created_at)
VALUES (
  101, 1, 1, 180.00, 'Dinner at Bistro 🍕', '[1, 2, 3]'::jsonb,
  '[{"userId": 1, "percentage": 100}]'::jsonb,
  '[{"userId": 1, "percentage": 33.34}, {"userId": 2, "percentage": 33.33}, {"userId": 3, "percentage": 33.33}]'::jsonb,
  1, NOW() - INTERVAL '3 days'
),
(
  102, 1, 2, 450.00, 'Grand Hotel Booking 🏨', '[1, 2, 3]'::jsonb,
  '[{"userId": 2, "percentage": 60}, {"userId": 3, "percentage": 40}]'::jsonb,
  '[{"userId": 1, "percentage": 30}, {"userId": 2, "percentage": 30}, {"userId": 3, "percentage": 40}]'::jsonb,
  2, NOW() - INTERVAL '2 days'
),
(
  103, 1, 3, 75.00, 'Airport Express Taxi 🚕', '[1, 4]'::jsonb,
  '[{"userId": 3, "percentage": 100}]'::jsonb,
  '[{"userId": 1, "percentage": 50}, {"userId": 4, "percentage": 50}]'::jsonb,
  1, NOW() - INTERVAL '1 day'
),
(
  104, 1, 4, -40.00, 'Cash loan for souvenirs 💵', '[2]'::jsonb,
  '[{"userId": 4, "percentage": 100}]'::jsonb,
  '[{"userId": 2, "percentage": 100}]'::jsonb,
  2, NOW() - INTERVAL '12 hours'
);

SELECT pg_catalog.setval('entries_id_seq', 105, true);

INSERT INTO entry_edits (entry_id, edited_by_user_id, old_amount, new_amount, old_description, new_description, edited_at)
VALUES (
  101, 1, 150.00, 180.00, 'Dinner at Bistro', 'Dinner at Bistro 🍕', NOW() - INTERVAL '2 days'
);

COMMIT;
