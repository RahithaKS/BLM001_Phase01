-- ================================
-- Seed Admin Users for LedgerLM
-- ================================
-- Run this AFTER the application has started and created the tables
-- Usage: psql -U postgres -d LedgerLM_Bosch_1 -f seed-admin.sql

-- ================================
-- Create Nemko Company
-- ================================
INSERT INTO companies (id, name, slug, description)
VALUES (
    gen_random_uuid(),
    'Nemko',
    'nemko',
    'Nemko Group AS - Testing, Inspection, and Certification'
)
ON CONFLICT (slug) DO NOTHING;

-- ================================
-- Create Bosch Company
-- ================================
INSERT INTO companies (id, name, slug, description)
VALUES (
    gen_random_uuid(),
    'Bosch',
    'bosch',
    'Robert Bosch GmbH - Engineering and Technology Company'
)
ON CONFLICT (slug) DO NOTHING;

-- ================================
-- Create Nemko Admin User
-- ================================
INSERT INTO users (id, username, display_name, role)
VALUES (
    gen_random_uuid(),
    'nemkomatasma@nemko.com',
    'Nemko Admin (Matasma)',
    'admin'
)
ON CONFLICT (username) DO UPDATE SET
    role = 'admin',
    display_name = 'Nemko Admin (Matasma)';

-- ================================
-- Create Bosch Admin User
-- ================================
INSERT INTO users (id, username, display_name, role)
VALUES (
    gen_random_uuid(),
    'matasmabosch@bosch.com',
    'Bosch Admin (Matasma)',
    'admin'
)
ON CONFLICT (username) DO UPDATE SET
    role = 'admin',
    display_name = 'Bosch Admin (Matasma)';

-- ================================
-- Create Company Memberships
-- ================================
-- Nemko Admin membership
INSERT INTO company_memberships (id, user_id, company_id, role)
SELECT 
    gen_random_uuid(),
    u.id,
    c.id,
    'admin'
FROM users u, companies c
WHERE u.username = 'nemkomatasma@nemko.com' 
AND c.slug = 'nemko'
ON CONFLICT DO NOTHING;

-- Bosch Admin membership
INSERT INTO company_memberships (id, user_id, company_id, role)
SELECT 
    gen_random_uuid(),
    u.id,
    c.id,
    'admin'
FROM users u, companies c
WHERE u.username = 'matasmabosch@bosch.com' 
AND c.slug = 'bosch'
ON CONFLICT DO NOTHING;

-- ================================
-- Create User Settings
-- ================================
-- Nemko Admin settings
INSERT INTO user_settings (id, user_id, enterprise_enabled, active_company_id)
SELECT 
    gen_random_uuid(),
    u.id,
    1,
    c.id
FROM users u, companies c
WHERE u.username = 'nemkomatasma@nemko.com' 
AND c.slug = 'nemko'
ON CONFLICT (user_id) DO UPDATE SET
    enterprise_enabled = 1;

-- Bosch Admin settings
INSERT INTO user_settings (id, user_id, enterprise_enabled, active_company_id)
SELECT 
    gen_random_uuid(),
    u.id,
    1,
    c.id
FROM users u, companies c
WHERE u.username = 'matasmabosch@bosch.com' 
AND c.slug = 'bosch'
ON CONFLICT (user_id) DO UPDATE SET
    enterprise_enabled = 1;

-- ================================
-- Verify the setup
-- ================================
SELECT '=== COMPANIES ===' as info;
SELECT id, name, slug FROM companies WHERE slug IN ('nemko', 'bosch');

SELECT '=== ADMIN USERS ===' as info;
SELECT id, username, display_name, role FROM users 
WHERE username IN ('nemkomatasma@nemko.com', 'matasmabosch@bosch.com');

SELECT '=== COMPANY MEMBERSHIPS ===' as info;
SELECT u.username, c.name as company, cm.role
FROM company_memberships cm
JOIN users u ON cm.user_id = u.id
JOIN companies c ON cm.company_id = c.id
WHERE u.username IN ('nemkomatasma@nemko.com', 'matasmabosch@bosch.com');

SELECT '=== USER SETTINGS ===' as info;
SELECT u.username, us.enterprise_enabled, c.name as active_company
FROM user_settings us
JOIN users u ON us.user_id = u.id
LEFT JOIN companies c ON us.active_company_id = c.id
WHERE u.username IN ('nemkomatasma@nemko.com', 'matasmabosch@bosch.com');
