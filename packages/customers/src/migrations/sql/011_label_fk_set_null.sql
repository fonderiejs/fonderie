-- Allow label catalog entries to be deleted even when in use.
-- Affected phone/email/address rows keep their label text column; label_id becomes NULL.

ALTER TABLE fonderie_customer_phones
    DROP CONSTRAINT IF EXISTS fonderie_customer_phones_label_id_fkey,
    ADD CONSTRAINT fonderie_customer_phones_label_id_fkey
        FOREIGN KEY (label_id) REFERENCES fonderie_customer_labels(id) ON DELETE SET NULL;

ALTER TABLE fonderie_customer_emails
    DROP CONSTRAINT IF EXISTS fonderie_customer_emails_label_id_fkey,
    ADD CONSTRAINT fonderie_customer_emails_label_id_fkey
        FOREIGN KEY (label_id) REFERENCES fonderie_customer_labels(id) ON DELETE SET NULL;

ALTER TABLE fonderie_customer_addresses
    DROP CONSTRAINT IF EXISTS fonderie_customer_addresses_label_id_fkey,
    ADD CONSTRAINT fonderie_customer_addresses_label_id_fkey
        FOREIGN KEY (label_id) REFERENCES fonderie_customer_labels(id) ON DELETE SET NULL;
