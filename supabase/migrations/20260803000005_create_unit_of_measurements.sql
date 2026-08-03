CREATE TABLE unit_of_measurements (
    id BIGSERIAL PRIMARY KEY,

    name VARCHAR(100) NOT NULL,
    abbreviation VARCHAR(20) NOT NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_unit_of_measurements_name UNIQUE (name),
    CONSTRAINT uq_unit_of_measurements_abbreviation UNIQUE (abbreviation)
);
