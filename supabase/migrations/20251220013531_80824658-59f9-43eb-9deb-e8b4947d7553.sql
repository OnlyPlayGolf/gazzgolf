-- Insert Aviara Golf Club course with proper UUID
INSERT INTO courses (id, name, location)
VALUES ('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 'Aviara Golf Club', 'Carlsbad, California');

-- Insert hole data for Aviara Golf Club (18 holes with realistic data)
INSERT INTO course_holes (course_id, hole_number, par, stroke_index, white_distance, blue_distance, yellow_distance) VALUES
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 1, 4, 7, 358, 385, 330),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 2, 4, 11, 365, 390, 335),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 3, 3, 15, 165, 185, 140),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 4, 5, 1, 485, 520, 450),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 5, 4, 9, 375, 400, 345),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 6, 3, 17, 155, 175, 130),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 7, 4, 5, 390, 420, 360),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 8, 5, 3, 510, 545, 475),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 9, 4, 13, 380, 405, 350),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 10, 4, 8, 370, 395, 340),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 11, 5, 2, 495, 530, 460),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 12, 3, 16, 170, 190, 145),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 13, 4, 10, 385, 410, 355),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 14, 4, 6, 395, 425, 365),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 15, 3, 18, 145, 165, 120),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 16, 5, 4, 505, 540, 470),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 17, 4, 12, 355, 380, 325),
('b5a3c2d1-e4f5-6789-abcd-ef1234567891', 18, 4, 14, 400, 430, 370);