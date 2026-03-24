-- ============================================================================
-- Coffee Store Management System - Complete Relational Schema (3NF)
-- ============================================================================

-- ============================================================================
-- 1. CUSTOMERS TABLE
-- ============================================================================
CREATE TABLE customers (
    customer_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120) UNIQUE NOT NULL,
    phone VARCHAR(15),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customers_email ON customers(email);
CREATE INDEX idx_customers_phone ON customers(phone);

-- ============================================================================
-- 2. INGREDIENTS TABLE
-- ============================================================================
CREATE TABLE ingredients (
    ingredient_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    category VARCHAR(50) NOT NULL, -- e.g., 'Coffee Beans', 'Milk', 'Sugar', 'Syrups'
    unit_of_measurement VARCHAR(20) NOT NULL, -- e.g., 'kg', 'liters', 'grams', 'pieces'
    stock_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    min_stock_level DECIMAL(10, 2),
    unit_cost DECIMAL(8, 2), -- Cost per unit for accounting
    supplier VARCHAR(100),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_ingredients_category ON ingredients(category);

-- ============================================================================
-- 3. PRODUCTS (MENU ITEMS) TABLE
-- ============================================================================
CREATE TABLE products (
    product_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL, -- e.g., 'Coffee', 'Tea', 'Snacks', 'Pastries'
    description TEXT,
    base_price DECIMAL(8, 2) NOT NULL,
    is_available BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_is_available ON products(is_available);

-- ============================================================================
-- 4. PRODUCT_INGREDIENTS TABLE (Many-to-Many: Products <-> Ingredients)
-- ============================================================================
CREATE TABLE product_ingredients (
    product_ingredient_id SERIAL PRIMARY KEY,
    product_id INTEGER NOT NULL,
    ingredient_id INTEGER NOT NULL,
    quantity_required DECIMAL(10, 2) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE CASCADE,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(ingredient_id) ON DELETE RESTRICT,
    UNIQUE(product_id, ingredient_id)
);

CREATE INDEX idx_product_ingredients_product_id ON product_ingredients(product_id);
CREATE INDEX idx_product_ingredients_ingredient_id ON product_ingredients(ingredient_id);

-- ============================================================================
-- 5. CUSTOMIZATIONS TABLE
-- ============================================================================
CREATE TABLE customizations (
    customization_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL, -- e.g., 'Size', 'Milk Type', 'Sugar Level'
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_customizations_name ON customizations(name);

-- ============================================================================
-- 6. CUSTOMIZATION_OPTIONS TABLE
-- ============================================================================
CREATE TABLE customization_options (
    option_id SERIAL PRIMARY KEY,
    customization_id INTEGER NOT NULL,
    option_value VARCHAR(100) NOT NULL, -- e.g., 'Small', 'Medium', 'Large' OR 'Whole Milk', 'Almond Milk'
    additional_price DECIMAL(8, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customization_id) REFERENCES customizations(customization_id) ON DELETE CASCADE,
    UNIQUE(customization_id, option_value)
);

CREATE INDEX idx_customization_options_customization_id ON customization_options(customization_id);

-- ============================================================================
-- 7. ORDERS TABLE
-- ============================================================================
CREATE TABLE orders (
    order_id SERIAL PRIMARY KEY,
    customer_id INTEGER NOT NULL,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- e.g., 'pending', 'preparing', 'ready', 'completed', 'cancelled'
    total_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (customer_id) REFERENCES customers(customer_id) ON DELETE RESTRICT
);

CREATE INDEX idx_orders_customer_id ON orders(customer_id);
CREATE INDEX idx_orders_order_date ON orders(order_date);
CREATE INDEX idx_orders_status ON orders(status);

-- ============================================================================
-- 8. ORDER_ITEMS TABLE (One-to-Many: Orders -> Order Items)
-- ============================================================================
CREATE TABLE order_items (
    order_item_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    product_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(8, 2) NOT NULL, -- Price at time of order
    subtotal DECIMAL(10, 2) NOT NULL, -- quantity * unit_price
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(product_id) ON DELETE RESTRICT
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);
CREATE INDEX idx_order_items_product_id ON order_items(product_id);

-- ============================================================================
-- 9. ORDER_ITEM_CUSTOMIZATIONS TABLE (Many-to-Many: Order Items <-> Customization Options)
-- ============================================================================
CREATE TABLE order_item_customizations (
    order_item_customization_id SERIAL PRIMARY KEY,
    order_item_id INTEGER NOT NULL,
    option_id INTEGER NOT NULL,
    additional_price_applied DECIMAL(8, 2) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_item_id) REFERENCES order_items(order_item_id) ON DELETE CASCADE,
    FOREIGN KEY (option_id) REFERENCES customization_options(option_id) ON DELETE RESTRICT
);

CREATE INDEX idx_order_item_customizations_order_item_id ON order_item_customizations(order_item_id);
CREATE INDEX idx_order_item_customizations_option_id ON order_item_customizations(option_id);

-- ============================================================================
-- 10. PAYMENTS TABLE
-- ============================================================================
CREATE TABLE payments (
    payment_id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL UNIQUE,
    payment_method VARCHAR(50) NOT NULL, -- e.g., 'cash', 'card', 'upi', 'mobile_wallet'
    amount_paid DECIMAL(10, 2) NOT NULL,
    payment_status VARCHAR(50) DEFAULT 'completed', -- e.g., 'pending', 'completed', 'failed', 'refunded'
    transaction_id VARCHAR(100), -- Reference from payment gateway
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(order_id) ON DELETE RESTRICT
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_payment_method ON payments(payment_method);
CREATE INDEX idx_payments_payment_date ON payments(payment_date);

-- ============================================================================
-- 11. INGREDIENT_INVENTORY_HISTORY TABLE (Optional - for tracking inventory changes)
-- ============================================================================
CREATE TABLE ingredient_inventory_history (
    history_id SERIAL PRIMARY KEY,
    ingredient_id INTEGER NOT NULL,
    previous_quantity DECIMAL(10, 2),
    new_quantity DECIMAL(10, 2) NOT NULL,
    change_type VARCHAR(50), -- e.g., 'purchase', 'consumption', 'adjustment', 'waste'
    reference_order_id INTEGER,
    notes TEXT,
    changed_by VARCHAR(100),
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (ingredient_id) REFERENCES ingredients(ingredient_id) ON DELETE RESTRICT,
    FOREIGN KEY (reference_order_id) REFERENCES orders(order_id) ON DELETE SET NULL
);

CREATE INDEX idx_ingredient_inventory_history_ingredient_id ON ingredient_inventory_history(ingredient_id);
CREATE INDEX idx_ingredient_inventory_history_changed_at ON ingredient_inventory_history(changed_at);

-- ============================================================================
-- 12. STAFF (Optional but recommended for operational tracking)
-- ============================================================================
CREATE TABLE staff (
    staff_id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(120),
    phone VARCHAR(15),
    role VARCHAR(50) NOT NULL, -- e.g., 'barista', 'manager', 'cashier', 'owner'
    is_active BOOLEAN DEFAULT TRUE,
    hire_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_staff_role ON staff(role);
CREATE INDEX idx_staff_is_active ON staff(is_active);

-- ============================================================================
-- SAMPLE DATA & VIEWS (Optional - for reference)
-- ============================================================================

-- View: Order Summary with Customer Details
CREATE VIEW order_summary AS
SELECT 
    o.order_id,
    c.customer_id,
    c.name AS customer_name,
    c.email,
    o.order_date,
    o.status,
    o.total_amount,
    COUNT(oi.order_item_id) AS item_count
FROM orders o
JOIN customers c ON o.customer_id = c.customer_id
LEFT JOIN order_items oi ON o.order_id = oi.order_id
GROUP BY o.order_id, c.customer_id, c.name, c.email, o.order_date, o.status, o.total_amount;

-- View: Product Profitability (requires cost data to be accurate)
CREATE VIEW product_profitability AS
SELECT 
    p.product_id,
    p.name,
    p.category,
    p.base_price,
    COUNT(oi.order_item_id) AS times_ordered,
    SUM(oi.subtotal) AS total_revenue
FROM products p
LEFT JOIN order_items oi ON p.product_id = oi.product_id
GROUP BY p.product_id, p.name, p.category, p.base_price;

-- ============================================================================
-- NORMALIZATION NOTES (up to 3NF)
-- ============================================================================
-- 1NF: All tables have atomic attributes, no repeating groups
--      - Order items are in a separate table (not nested in orders)
--      - Customizations are normalized separately
--
-- 2NF: All non-key attributes are fully functionally dependent on the primary key
--      - No partial dependencies
--      - Product_ingredients links two entities without introducing anomalies
--
-- 3NF: No transitive dependencies
--      - Order_item_customizations has order_item_id and option_id as FK
--      - No derived attributes (e.g., subtotal in order_items is stored for query efficiency)
--      - Ingredient prices are stored in ingredient table, not duplicated
--
-- Many-to-Many Relationships:
--      - Products <-> Ingredients via product_ingredients
--      - Order Items <-> Customization Options via order_item_customizations
--
-- One-to-Many Relationships:
--      - Customers -> Orders
--      - Orders -> Order Items
--      - Customizations -> Customization Options
--      - Ingredients -> Inventory History
--
-- Cascade Rules:
--      - CASCADE DELETE: Used for dependent data (e.g., order_items when order deleted)
--      - RESTRICT: Used to protect referential integrity (e.g., cannot delete ingredient if used in product)
--      - SET NULL: Used where appropriate (e.g., inventory history reference_order_id)
-- ============================================================================
