ALTER TABLE order_items
    DROP COLUMN note,
    DROP COLUMN image_url;

ALTER TABLE orders
    DROP COLUMN cancellation_detail,
    DROP COLUMN cancellation_code;
