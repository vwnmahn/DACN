-- Add retry-safe identity to voucher redemption requests.
-- Existing rows remain compatible because idempotency_key is nullable.

ALTER TABLE voucher_redemptions
    ADD COLUMN idempotency_key VARCHAR(100) NULL AFTER redeemed_at,
    ADD CONSTRAINT uk_voucher_redemption_account_idempotency
        UNIQUE (account_id, idempotency_key);
