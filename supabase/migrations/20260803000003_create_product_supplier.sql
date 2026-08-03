CREATE TABLE product_supplier (
    id BIGSERIAL PRIMARY KEY,

    product_id BIGINT NOT NULL,
    supplier_id BIGINT NOT NULL,

    is_primary BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_product_supplier_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_product_supplier_supplier
        FOREIGN KEY (supplier_id)
        REFERENCES suppliers(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_product_supplier
        UNIQUE (product_id, supplier_id)
);

CREATE INDEX idx_product_supplier_product
    ON product_supplier(product_id);

CREATE INDEX idx_product_supplier_supplier
    ON product_supplier(supplier_id);
