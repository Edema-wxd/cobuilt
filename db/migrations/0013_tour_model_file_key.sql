-- 0013_tour_model_file_key.sql
-- Object storage moved from S3 to UploadThing, so the column no longer holds an
-- S3 key. Existing values are kept; any pointing at the old bucket must be
-- re-uploaded because UploadThing cannot serve them.
ALTER TABLE virtual_tours RENAME COLUMN model_file_s3_key TO model_file_key;
