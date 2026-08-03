CREATE TABLE product_warehouse (
    id BIGSERIAL PRIMARY KEY,

    product_id BIGINT NOT NULL,
    warehouse_id BIGINT NOT NULL,

    stock INTEGER NOT NULL DEFAULT 0,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_product_warehouse_product
        FOREIGN KEY (product_id)
        REFERENCES products(id)
        ON DELETE CASCADE,

    CONSTRAINT fk_product_warehouse_warehouse
        FOREIGN KEY (warehouse_id)
        REFERENCES warehouses(id)
        ON DELETE CASCADE,

    CONSTRAINT uq_product_warehouse
        UNIQUE (product_id, warehouse_id)
);

CREATE INDEX idx_product_warehouse_product
    ON product_warehouse(product_id);

CREATE INDEX idx_product_warehouse_warehouse
    ON product_warehouse(warehouse_id);
