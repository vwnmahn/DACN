ALTER TABLE orders
    ADD COLUMN cancellation_code VARCHAR(30) NULL AFTER cancellation_reason,
    ADD COLUMN cancellation_detail VARCHAR(500) NULL AFTER cancellation_code;

ALTER TABLE order_items
    ADD COLUMN image_url VARCHAR(1000) NULL AFTER item_name,
    ADD COLUMN note VARCHAR(500) NULL AFTER image_url;
