-- Oulimata PostgreSQL schema, exported from Neon database US.

-- Paste into a fresh, empty PostgreSQL database only.

-- Generated from the Alembic schema at revision 0022_hidden_organization_modules.

BEGIN;

SET search_path = public;

CREATE TABLE public.agriculture_campaigns (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	parcel_id UUID NOT NULL, 
	crop_id UUID NOT NULL, 
	created_by_id UUID NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	season VARCHAR(80) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	start_date DATE NOT NULL, 
	expected_harvest_date DATE NOT NULL, 
	area_hectares NUMERIC(8, 2) NOT NULL, 
	expected_yield_kg_per_hectare NUMERIC(12, 2) NOT NULL, 
	expected_price_fcfa_per_kg NUMERIC(14, 2) NOT NULL, 
	estimated_input_cost_fcfa BIGINT NOT NULL, 
	estimated_other_cost_fcfa BIGINT NOT NULL, 
	simulated_at TIMESTAMP WITH TIME ZONE, 
	started_at TIMESTAMP WITH TIME ZONE, 
	closed_at TIMESTAMP WITH TIME ZONE, 
	archived_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT agriculture_campaigns_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_agriculture_campaigns_org_id UNIQUE NULLS DISTINCT (organization_id, id), 
	CONSTRAINT ck_agriculture_campaigns_area_positive CHECK (area_hectares > 0::numeric), 
	CONSTRAINT ck_agriculture_campaigns_costs_nonnegative CHECK (estimated_input_cost_fcfa >= 0 AND estimated_other_cost_fcfa >= 0), 
	CONSTRAINT ck_agriculture_campaigns_price_nonnegative CHECK (expected_price_fcfa_per_kg >= 0::numeric), 
	CONSTRAINT ck_agriculture_campaigns_status CHECK (status::text = ANY (ARRAY['planned'::character varying, 'simulated'::character varying, 'active'::character varying, 'closed'::character varying, 'archived'::character varying]::text[])), 
	CONSTRAINT ck_agriculture_campaigns_yield_nonnegative CHECK (expected_yield_kg_per_hectare >= 0::numeric)
);

CREATE TABLE public.agriculture_crops (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT agriculture_crops_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_agriculture_crops_org_id UNIQUE NULLS DISTINCT (organization_id, id), 
	CONSTRAINT uq_agriculture_crops_org_name UNIQUE NULLS DISTINCT (organization_id, name)
);

CREATE TABLE public.agriculture_farms (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	created_by_id UUID NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	location VARCHAR(180), 
	photo_filename VARCHAR(80), 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT agriculture_farms_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_agriculture_farms_org_id UNIQUE NULLS DISTINCT (organization_id, id), 
	CONSTRAINT uq_agriculture_farms_org_name UNIQUE NULLS DISTINCT (organization_id, name)
);

CREATE TABLE public.agriculture_finance_transactions (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	farm_id UUID NOT NULL, 
	campaign_id UUID, 
	created_by_id UUID NOT NULL, 
	transaction_type VARCHAR(8) NOT NULL, 
	category VARCHAR(24) NOT NULL, 
	label VARCHAR(160) NOT NULL, 
	amount_fcfa BIGINT NOT NULL, 
	transaction_date DATE NOT NULL, 
	quantity NUMERIC(12, 2), 
	unit VARCHAR(24), 
	customer_name VARCHAR(160), 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	customer_id UUID, 
	source VARCHAR(16) NOT NULL, 
	CONSTRAINT agriculture_finance_transactions_pkey PRIMARY KEY (id), 
	CONSTRAINT ck_agriculture_finance_amount_positive CHECK (amount_fcfa > 0), 
	CONSTRAINT ck_agriculture_finance_type CHECK (transaction_type::text = ANY (ARRAY['income'::character varying, 'expense'::character varying]::text[]))
);

CREATE TABLE public.agriculture_harvests (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	parcel_id UUID NOT NULL, 
	created_by_id UUID NOT NULL, 
	harvest_date DATE NOT NULL, 
	quantity_kg NUMERIC(12, 2) NOT NULL, 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	campaign_id UUID, 
	CONSTRAINT agriculture_harvests_pkey PRIMARY KEY (id), 
	CONSTRAINT ck_agriculture_harvests_quantity_positive CHECK (quantity_kg > 0::numeric)
);

CREATE TABLE public.agriculture_parcels (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	created_by_id UUID NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	crop VARCHAR(120) NOT NULL, 
	area_hectares NUMERIC(8, 2) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	farm_id UUID NOT NULL, 
	crop_id UUID NOT NULL, 
	photo_filename VARCHAR(80), 
	CONSTRAINT agriculture_parcels_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_agriculture_parcels_org_id UNIQUE NULLS DISTINCT (organization_id, id), 
	CONSTRAINT uq_agriculture_parcels_org_name UNIQUE NULLS DISTINCT (organization_id, name), 
	CONSTRAINT ck_agriculture_parcels_area_positive CHECK (area_hectares > 0::numeric)
);

CREATE TABLE public.alembic_version (
	version_num VARCHAR(32) NOT NULL, 
	CONSTRAINT alembic_version_pkc PRIMARY KEY (version_num)
);

CREATE TABLE public.communication_posts (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	created_by_id UUID NOT NULL, 
	title VARCHAR(160) NOT NULL, 
	caption TEXT NOT NULL, 
	hashtags VARCHAR(1000), 
	platform VARCHAR(16) NOT NULL, 
	content_format VARCHAR(16) NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	scheduled_date DATE, 
	published_at TIMESTAMP WITH TIME ZONE, 
	published_url VARCHAR(1000), 
	media_filename VARCHAR(120), 
	media_mime_type VARCHAR(80), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT communication_posts_pkey PRIMARY KEY (id), 
	CONSTRAINT ck_communication_post_format CHECK (content_format::text = ANY (ARRAY['video'::character varying, 'photo'::character varying, 'story'::character varying]::text[])), 
	CONSTRAINT ck_communication_post_platform CHECK (platform::text = ANY (ARRAY['tiktok'::character varying, 'facebook'::character varying, 'both'::character varying]::text[])), 
	CONSTRAINT ck_communication_post_status CHECK (status::text = ANY (ARRAY['draft'::character varying, 'scheduled'::character varying, 'published'::character varying, 'archived'::character varying]::text[]))
);

CREATE TABLE public.hr_absence_requests (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	user_id UUID NOT NULL, 
	reviewed_by_id UUID, 
	absence_type VARCHAR(20) NOT NULL, 
	start_date DATE NOT NULL, 
	end_date DATE NOT NULL, 
	reason VARCHAR(1000) NOT NULL, 
	status VARCHAR(12) NOT NULL, 
	reviewer_note VARCHAR(1000), 
	reviewed_at TIMESTAMP WITH TIME ZONE, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT hr_absence_requests_pkey PRIMARY KEY (id), 
	CONSTRAINT ck_hr_absence_date_order CHECK (end_date >= start_date), 
	CONSTRAINT ck_hr_absence_status CHECK (status::text = ANY (ARRAY['pending'::character varying, 'approved'::character varying, 'rejected'::character varying, 'cancelled'::character varying]::text[])), 
	CONSTRAINT ck_hr_absence_type CHECK (absence_type::text = ANY (ARRAY['annual_leave'::character varying, 'sick_leave'::character varying, 'family_event'::character varying, 'unpaid'::character varying, 'other'::character varying]::text[]))
);

CREATE TABLE public.hr_payroll_records (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	user_id UUID NOT NULL, 
	created_by_id UUID NOT NULL, 
	pay_year INTEGER NOT NULL, 
	pay_month INTEGER NOT NULL, 
	gross_pay_fcfa BIGINT NOT NULL, 
	bonus_fcfa BIGINT NOT NULL, 
	deductions_fcfa BIGINT NOT NULL, 
	net_pay_fcfa BIGINT NOT NULL, 
	payment_status VARCHAR(12) NOT NULL, 
	paid_at DATE, 
	note TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT hr_payroll_records_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_hr_payroll_employee_period UNIQUE NULLS DISTINCT (organization_id, user_id, pay_year, pay_month), 
	CONSTRAINT ck_hr_payroll_bonus_nonnegative CHECK (bonus_fcfa >= 0), 
	CONSTRAINT ck_hr_payroll_deductions_nonnegative CHECK (deductions_fcfa >= 0), 
	CONSTRAINT ck_hr_payroll_gross_positive CHECK (gross_pay_fcfa > 0), 
	CONSTRAINT ck_hr_payroll_month CHECK (pay_month >= 1 AND pay_month <= 12), 
	CONSTRAINT ck_hr_payroll_net_nonnegative CHECK (net_pay_fcfa >= 0), 
	CONSTRAINT ck_hr_payroll_status CHECK (payment_status::text = ANY (ARRAY['pending'::character varying, 'paid'::character varying]::text[])), 
	CONSTRAINT ck_hr_payroll_year CHECK (pay_year >= 2000 AND pay_year <= 2100)
);

CREATE TABLE public.livestock_animals (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	facility_id UUID, 
	group_id UUID, 
	created_by_id UUID NOT NULL, 
	name VARCHAR(120), 
	tag_number VARCHAR(80), 
	species VARCHAR(60) NOT NULL, 
	breed VARCHAR(100), 
	sex VARCHAR(12) NOT NULL, 
	birth_date DATE, 
	entry_date DATE NOT NULL, 
	photo_filename VARCHAR(80), 
	notes TEXT, 
	status VARCHAR(12) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT livestock_animals_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_livestock_animals_org_id UNIQUE NULLS DISTINCT (organization_id, id), 
	CONSTRAINT uq_livestock_animals_org_tag UNIQUE NULLS DISTINCT (organization_id, tag_number), 
	CONSTRAINT ck_livestock_animals_sex CHECK (sex::text = ANY (ARRAY['female'::character varying, 'male'::character varying, 'unknown'::character varying]::text[])), 
	CONSTRAINT ck_livestock_animals_status CHECK (status::text = ANY (ARRAY['active'::character varying, 'sold'::character varying, 'deceased'::character varying]::text[]))
);

CREATE TABLE public.livestock_facilities (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	farm_id UUID, 
	created_by_id UUID NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	facility_type VARCHAR(24) NOT NULL, 
	location VARCHAR(180), 
	photo_filename VARCHAR(80), 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT livestock_facilities_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_livestock_facilities_org_id UNIQUE NULLS DISTINCT (organization_id, id), 
	CONSTRAINT uq_livestock_facilities_org_name UNIQUE NULLS DISTINCT (organization_id, name)
);

CREATE TABLE public.livestock_finance_transactions (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	animal_id UUID, 
	group_id UUID, 
	facility_id UUID, 
	source_record_id UUID, 
	created_by_id UUID NOT NULL, 
	transaction_type VARCHAR(8) NOT NULL, 
	category VARCHAR(32) NOT NULL, 
	label VARCHAR(160) NOT NULL, 
	amount_fcfa BIGINT NOT NULL, 
	transaction_date DATE NOT NULL, 
	quantity NUMERIC(14, 3), 
	unit VARCHAR(24), 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT livestock_finance_transactions_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_livestock_finance_source_record UNIQUE NULLS DISTINCT (source_record_id), 
	CONSTRAINT ck_livestock_finance_amount_positive CHECK (amount_fcfa > 0), 
	CONSTRAINT ck_livestock_finance_one_subject CHECK (animal_id IS NULL OR group_id IS NULL), 
	CONSTRAINT ck_livestock_finance_type CHECK (transaction_type::text = ANY (ARRAY['income'::character varying, 'expense'::character varying]::text[]))
);

CREATE TABLE public.livestock_groups (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	facility_id UUID, 
	created_by_id UUID NOT NULL, 
	name VARCHAR(120) NOT NULL, 
	species VARCHAR(60) NOT NULL, 
	breed VARCHAR(100), 
	head_count INTEGER NOT NULL, 
	entry_date DATE NOT NULL, 
	notes TEXT, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT livestock_groups_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_livestock_groups_org_id UNIQUE NULLS DISTINCT (organization_id, id), 
	CONSTRAINT ck_livestock_groups_head_count_positive CHECK (head_count > 0)
);

CREATE TABLE public.livestock_records (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	animal_id UUID, 
	group_id UUID, 
	facility_id UUID, 
	created_by_id UUID NOT NULL, 
	record_type VARCHAR(16) NOT NULL, 
	category VARCHAR(32) NOT NULL, 
	title VARCHAR(160) NOT NULL, 
	event_date DATE NOT NULL, 
	quantity NUMERIC(14, 3), 
	unit VARCHAR(24), 
	amount_fcfa BIGINT NOT NULL, 
	next_due_date DATE, 
	is_resolved BOOLEAN DEFAULT false NOT NULL, 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT livestock_records_pkey PRIMARY KEY (id), 
	CONSTRAINT ck_livestock_records_amount CHECK (amount_fcfa >= 0), 
	CONSTRAINT ck_livestock_records_one_subject CHECK (animal_id IS NOT NULL AND group_id IS NULL OR animal_id IS NULL AND group_id IS NOT NULL), 
	CONSTRAINT ck_livestock_records_quantity CHECK (quantity IS NULL OR quantity > 0::numeric), 
	CONSTRAINT ck_livestock_records_type CHECK (record_type::text = ANY (ARRAY['health'::character varying, 'reproduction'::character varying, 'production'::character varying, 'feed'::character varying]::text[]))
);

CREATE TABLE public.memberships (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	user_id UUID NOT NULL, 
	role VARCHAR(16) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	phone VARCHAR(32), 
	photo_filename VARCHAR(80), 
	job_title VARCHAR(120), 
	department VARCHAR(100), 
	hire_date DATE, 
	employment_type VARCHAR(24), 
	employment_status VARCHAR(16) NOT NULL, 
	CONSTRAINT memberships_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_memberships_organization_user UNIQUE NULLS DISTINCT (organization_id, user_id), 
	CONSTRAINT ck_memberships_employment_status CHECK (employment_status::text = ANY (ARRAY['active'::character varying, 'on_leave'::character varying, 'ended'::character varying]::text[])), 
	CONSTRAINT ck_memberships_role CHECK (role::text = ANY (ARRAY['owner'::character varying, 'admin'::character varying, 'manager'::character varying, 'operator'::character varying, 'reader'::character varying]::text[]))
);

CREATE TABLE public.operation_task_updates (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	task_id UUID NOT NULL, 
	user_id UUID NOT NULL, 
	status VARCHAR(16), 
	note TEXT, 
	delay_reason TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT operation_task_updates_pkey PRIMARY KEY (id)
);

CREATE TABLE public.operation_tasks (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	title VARCHAR(160) NOT NULL, 
	description TEXT, 
	status VARCHAR(16) NOT NULL, 
	priority VARCHAR(16) NOT NULL, 
	due_date DATE, 
	assigned_user_id UUID, 
	created_by_id UUID NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	progress_note TEXT, 
	delay_reason TEXT, 
	CONSTRAINT operation_tasks_pkey PRIMARY KEY (id), 
	CONSTRAINT ck_operation_tasks_priority CHECK (priority::text = ANY (ARRAY['low'::character varying, 'normal'::character varying, 'high'::character varying, 'urgent'::character varying]::text[])), 
	CONSTRAINT ck_operation_tasks_status CHECK (status::text = ANY (ARRAY['todo'::character varying, 'in_progress'::character varying, 'done'::character varying, 'archived'::character varying]::text[]))
);

CREATE TABLE public.organizations (
	id UUID NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	slug VARCHAR(180) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	description TEXT, 
	legal_form VARCHAR(120), 
	phone VARCHAR(32), 
	email VARCHAR(320), 
	address VARCHAR(500), 
	website VARCHAR(500), 
	facebook_url VARCHAR(500), 
	tiktok_url VARCHAR(500), 
	hidden_modules JSON DEFAULT '[]'::json NOT NULL, 
	CONSTRAINT organizations_pkey PRIMARY KEY (id), 
	CONSTRAINT organizations_slug_key UNIQUE NULLS DISTINCT (slug)
);

CREATE TABLE public.products (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	description TEXT, 
	category VARCHAR(80), 
	unit VARCHAR(40) NOT NULL, 
	price_fcfa BIGINT NOT NULL, 
	stock_quantity INTEGER NOT NULL, 
	is_published BOOLEAN NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	photo_filename VARCHAR(80), 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL, 
	CONSTRAINT products_pkey PRIMARY KEY (id), 
	CONSTRAINT ck_products_price_positive CHECK (price_fcfa > 0), 
	CONSTRAINT ck_products_stock_nonnegative CHECK (stock_quantity >= 0)
);

CREATE TABLE public.sales_customers (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	customer_type VARCHAR(16) NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	company_name VARCHAR(160), 
	phone VARCHAR(32) NOT NULL, 
	email VARCHAR(320), 
	address VARCHAR(500), 
	city VARCHAR(100), 
	notes TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	user_id UUID, 
	CONSTRAINT sales_customers_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_sales_customers_user_id UNIQUE NULLS DISTINCT (user_id)
);

CREATE TABLE public.sales_order_items (
	id UUID NOT NULL, 
	order_id UUID NOT NULL, 
	product_id UUID, 
	product_name VARCHAR(160) NOT NULL, 
	unit VARCHAR(40) NOT NULL, 
	quantity INTEGER NOT NULL, 
	unit_price_fcfa BIGINT NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT sales_order_items_pkey PRIMARY KEY (id), 
	CONSTRAINT ck_sales_order_items_price_positive CHECK (unit_price_fcfa > 0), 
	CONSTRAINT ck_sales_order_items_quantity_positive CHECK (quantity > 0)
);

CREATE TABLE public.sales_order_status_events (
	id UUID NOT NULL, 
	order_id UUID NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	actor_id UUID, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT sales_order_status_events_pkey PRIMARY KEY (id), 
	CONSTRAINT ck_sales_order_status_events_status CHECK (status::text = ANY (ARRAY['pending'::character varying, 'confirmed'::character varying, 'preparing'::character varying, 'delivered'::character varying, 'cancelled'::character varying]::text[]))
);

CREATE TABLE public.sales_orders (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	created_by_id UUID, 
	reference VARCHAR(32) NOT NULL, 
	customer_name VARCHAR(160) NOT NULL, 
	order_date DATE NOT NULL, 
	amount_fcfa BIGINT NOT NULL, 
	status VARCHAR(16) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	customer_phone VARCHAR(32), 
	customer_email VARCHAR(320), 
	delivery_address VARCHAR(500), 
	customer_id UUID, 
	CONSTRAINT sales_orders_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_sales_orders_org_reference UNIQUE NULLS DISTINCT (organization_id, reference), 
	CONSTRAINT ck_sales_orders_amount_positive CHECK (amount_fcfa > 0), 
	CONSTRAINT ck_sales_orders_status CHECK (status::text = ANY (ARRAY['pending'::character varying, 'confirmed'::character varying, 'preparing'::character varying, 'delivered'::character varying, 'cancelled'::character varying]::text[]))
);

CREATE TABLE public.stock_items (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	product_id UUID, 
	source VARCHAR(16) NOT NULL, 
	name VARCHAR(160) NOT NULL, 
	unit VARCHAR(40) NOT NULL, 
	location VARCHAR(120) NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT stock_items_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_stock_items_org_id UNIQUE NULLS DISTINCT (organization_id, id), 
	CONSTRAINT ck_stock_items_source CHECK (source::text = ANY (ARRAY['agriculture'::character varying, 'elevage'::character varying, 'other'::character varying]::text[]))
);

CREATE TABLE public.stock_movements (
	id UUID NOT NULL, 
	organization_id UUID NOT NULL, 
	stock_item_id UUID NOT NULL, 
	created_by_id UUID, 
	movement_type VARCHAR(16) NOT NULL, 
	direction VARCHAR(3) NOT NULL, 
	quantity NUMERIC(14, 3) NOT NULL, 
	movement_date DATE NOT NULL, 
	reference_type VARCHAR(32), 
	reference_id UUID, 
	transfer_id UUID, 
	note TEXT, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	CONSTRAINT stock_movements_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_stock_movements_org_reference UNIQUE NULLS DISTINCT (organization_id, reference_type, reference_id), 
	CONSTRAINT ck_stock_movements_direction CHECK (direction::text = ANY (ARRAY['in'::character varying, 'out'::character varying]::text[])), 
	CONSTRAINT ck_stock_movements_quantity_positive CHECK (quantity > 0::numeric), 
	CONSTRAINT ck_stock_movements_type CHECK (movement_type::text = ANY (ARRAY['opening'::character varying, 'production'::character varying, 'sale'::character varying, 'cancellation'::character varying, 'addition'::character varying, 'loss'::character varying, 'consumption'::character varying, 'adjustment'::character varying, 'transfer_in'::character varying, 'transfer_out'::character varying]::text[]))
);

CREATE TABLE public.users (
	id UUID NOT NULL, 
	email VARCHAR(320), 
	full_name VARCHAR(160) NOT NULL, 
	password_hash VARCHAR(255) NOT NULL, 
	is_active BOOLEAN NOT NULL, 
	created_at TIMESTAMP WITH TIME ZONE NOT NULL, 
	username VARCHAR(32) NOT NULL, 
	CONSTRAINT users_pkey PRIMARY KEY (id), 
	CONSTRAINT uq_users_username UNIQUE NULLS DISTINCT (username), 
	CONSTRAINT users_email_key UNIQUE NULLS DISTINCT (email)
);

ALTER TABLE public.agriculture_campaigns ADD CONSTRAINT fk_agriculture_campaigns_created_by_id_users FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.agriculture_campaigns ADD CONSTRAINT fk_agriculture_campaigns_org_crop FOREIGN KEY(organization_id, crop_id) REFERENCES public.agriculture_crops (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.agriculture_campaigns ADD CONSTRAINT fk_agriculture_campaigns_org_parcel FOREIGN KEY(organization_id, parcel_id) REFERENCES public.agriculture_parcels (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.agriculture_campaigns ADD CONSTRAINT fk_agriculture_campaigns_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.agriculture_crops ADD CONSTRAINT fk_agriculture_crops_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.agriculture_farms ADD CONSTRAINT fk_agriculture_farms_created_by_id_users FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.agriculture_farms ADD CONSTRAINT fk_agriculture_farms_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.agriculture_finance_transactions ADD CONSTRAINT fk_agri_finance_org FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.agriculture_finance_transactions ADD CONSTRAINT fk_agriculture_finance_customer_id_sales_customers FOREIGN KEY(customer_id) REFERENCES public.sales_customers (id) ON DELETE SET NULL;

ALTER TABLE public.agriculture_finance_transactions ADD CONSTRAINT fk_agriculture_finance_org_campaign FOREIGN KEY(organization_id, campaign_id) REFERENCES public.agriculture_campaigns (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.agriculture_finance_transactions ADD CONSTRAINT fk_agriculture_finance_org_farm FOREIGN KEY(organization_id, farm_id) REFERENCES public.agriculture_farms (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.agriculture_finance_transactions ADD CONSTRAINT fk_agriculture_finance_transactions_created_by_id_users FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.agriculture_harvests ADD CONSTRAINT fk_agriculture_harvests_created_by_id_users FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.agriculture_harvests ADD CONSTRAINT fk_agriculture_harvests_org_campaign FOREIGN KEY(organization_id, campaign_id) REFERENCES public.agriculture_campaigns (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.agriculture_harvests ADD CONSTRAINT fk_agriculture_harvests_org_parcel FOREIGN KEY(organization_id, parcel_id) REFERENCES public.agriculture_parcels (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.agriculture_harvests ADD CONSTRAINT fk_agriculture_harvests_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.agriculture_parcels ADD CONSTRAINT fk_agriculture_parcels_created_by_id_users FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.agriculture_parcels ADD CONSTRAINT fk_agriculture_parcels_org_crop FOREIGN KEY(organization_id, crop_id) REFERENCES public.agriculture_crops (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.agriculture_parcels ADD CONSTRAINT fk_agriculture_parcels_org_farm FOREIGN KEY(organization_id, farm_id) REFERENCES public.agriculture_farms (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.agriculture_parcels ADD CONSTRAINT fk_agriculture_parcels_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.communication_posts ADD CONSTRAINT fk_communication_posts_created_by_id_users FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.communication_posts ADD CONSTRAINT fk_communication_posts_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.hr_absence_requests ADD CONSTRAINT fk_hr_absence_requests_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.hr_absence_requests ADD CONSTRAINT fk_hr_absence_requests_reviewed_by_id_users FOREIGN KEY(reviewed_by_id) REFERENCES public.users (id) ON DELETE SET NULL;

ALTER TABLE public.hr_absence_requests ADD CONSTRAINT fk_hr_absence_requests_user_id_users FOREIGN KEY(user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.hr_payroll_records ADD CONSTRAINT fk_hr_payroll_records_created_by_id_users FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.hr_payroll_records ADD CONSTRAINT fk_hr_payroll_records_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.hr_payroll_records ADD CONSTRAINT fk_hr_payroll_records_user_id_users FOREIGN KEY(user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_animals ADD CONSTRAINT fk_livestock_animals_creator FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_animals ADD CONSTRAINT fk_livestock_animals_org_facility FOREIGN KEY(organization_id, facility_id) REFERENCES public.livestock_facilities (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_animals ADD CONSTRAINT fk_livestock_animals_org_group FOREIGN KEY(organization_id, group_id) REFERENCES public.livestock_groups (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_animals ADD CONSTRAINT fk_livestock_animals_organization FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.livestock_facilities ADD CONSTRAINT fk_livestock_facilities_creator FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_facilities ADD CONSTRAINT fk_livestock_facilities_org_farm FOREIGN KEY(organization_id, farm_id) REFERENCES public.agriculture_farms (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_facilities ADD CONSTRAINT fk_livestock_facilities_organization FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.livestock_finance_transactions ADD CONSTRAINT fk_livestock_finance_org_animal FOREIGN KEY(organization_id, animal_id) REFERENCES public.livestock_animals (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_finance_transactions ADD CONSTRAINT fk_livestock_finance_org_facility FOREIGN KEY(organization_id, facility_id) REFERENCES public.livestock_facilities (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_finance_transactions ADD CONSTRAINT fk_livestock_finance_org_group FOREIGN KEY(organization_id, group_id) REFERENCES public.livestock_groups (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_finance_transactions ADD CONSTRAINT fk_livestock_finance_transactions_creator FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_finance_transactions ADD CONSTRAINT fk_livestock_finance_transactions_organization FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.livestock_finance_transactions ADD CONSTRAINT fk_livestock_finance_transactions_source_record FOREIGN KEY(source_record_id) REFERENCES public.livestock_records (id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_groups ADD CONSTRAINT fk_livestock_groups_creator FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_groups ADD CONSTRAINT fk_livestock_groups_org_facility FOREIGN KEY(organization_id, facility_id) REFERENCES public.livestock_facilities (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_groups ADD CONSTRAINT fk_livestock_groups_organization FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.livestock_records ADD CONSTRAINT fk_livestock_records_creator FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_records ADD CONSTRAINT fk_livestock_records_org_animal FOREIGN KEY(organization_id, animal_id) REFERENCES public.livestock_animals (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_records ADD CONSTRAINT fk_livestock_records_org_facility FOREIGN KEY(organization_id, facility_id) REFERENCES public.livestock_facilities (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_records ADD CONSTRAINT fk_livestock_records_org_group FOREIGN KEY(organization_id, group_id) REFERENCES public.livestock_groups (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.livestock_records ADD CONSTRAINT fk_livestock_records_organization FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.memberships ADD CONSTRAINT fk_memberships_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.memberships ADD CONSTRAINT fk_memberships_user_id_users FOREIGN KEY(user_id) REFERENCES public.users (id) ON DELETE CASCADE;

ALTER TABLE public.operation_task_updates ADD CONSTRAINT fk_operation_task_updates_organization FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.operation_task_updates ADD CONSTRAINT fk_operation_task_updates_task FOREIGN KEY(task_id) REFERENCES public.operation_tasks (id) ON DELETE CASCADE;

ALTER TABLE public.operation_task_updates ADD CONSTRAINT fk_operation_task_updates_user FOREIGN KEY(user_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.operation_tasks ADD CONSTRAINT fk_operation_tasks_assigned_user_id_users FOREIGN KEY(assigned_user_id) REFERENCES public.users (id) ON DELETE SET NULL;

ALTER TABLE public.operation_tasks ADD CONSTRAINT fk_operation_tasks_created_by_id_users FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.operation_tasks ADD CONSTRAINT fk_operation_tasks_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.products ADD CONSTRAINT fk_products_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.sales_customers ADD CONSTRAINT fk_sales_customers_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.sales_customers ADD CONSTRAINT fk_sales_customers_user_id_users FOREIGN KEY(user_id) REFERENCES public.users (id) ON DELETE SET NULL;

ALTER TABLE public.sales_order_items ADD CONSTRAINT fk_sales_order_items_order_id_sales_orders FOREIGN KEY(order_id) REFERENCES public.sales_orders (id) ON DELETE CASCADE;

ALTER TABLE public.sales_order_items ADD CONSTRAINT fk_sales_order_items_product_id_products FOREIGN KEY(product_id) REFERENCES public.products (id) ON DELETE SET NULL;

ALTER TABLE public.sales_order_status_events ADD CONSTRAINT fk_sales_order_status_events_actor_id_users FOREIGN KEY(actor_id) REFERENCES public.users (id) ON DELETE SET NULL;

ALTER TABLE public.sales_order_status_events ADD CONSTRAINT fk_sales_order_status_events_order_id_sales_orders FOREIGN KEY(order_id) REFERENCES public.sales_orders (id) ON DELETE CASCADE;

ALTER TABLE public.sales_orders ADD CONSTRAINT fk_sales_orders_created_by_id_users FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE RESTRICT;

ALTER TABLE public.sales_orders ADD CONSTRAINT fk_sales_orders_customer_id_sales_customers FOREIGN KEY(customer_id) REFERENCES public.sales_customers (id) ON DELETE SET NULL;

ALTER TABLE public.sales_orders ADD CONSTRAINT fk_sales_orders_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.stock_items ADD CONSTRAINT fk_stock_items_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

ALTER TABLE public.stock_items ADD CONSTRAINT fk_stock_items_product_id_products FOREIGN KEY(product_id) REFERENCES public.products (id) ON DELETE SET NULL;

ALTER TABLE public.stock_movements ADD CONSTRAINT fk_stock_movements_created_by_id_users FOREIGN KEY(created_by_id) REFERENCES public.users (id) ON DELETE SET NULL;

ALTER TABLE public.stock_movements ADD CONSTRAINT fk_stock_movements_org_item FOREIGN KEY(organization_id, stock_item_id) REFERENCES public.stock_items (organization_id, id) ON DELETE RESTRICT;

ALTER TABLE public.stock_movements ADD CONSTRAINT fk_stock_movements_organization_id_organizations FOREIGN KEY(organization_id) REFERENCES public.organizations (id) ON DELETE CASCADE;

CREATE INDEX ix_agriculture_campaigns_org_status ON public.agriculture_campaigns (organization_id, status);

CREATE INDEX ix_agriculture_crops_org_active ON public.agriculture_crops (organization_id, is_active);

CREATE INDEX ix_agriculture_farms_org_active ON public.agriculture_farms (organization_id, is_active);

CREATE INDEX ix_agriculture_finance_org_date ON public.agriculture_finance_transactions (organization_id, transaction_date);

CREATE INDEX ix_agriculture_finance_org_farm ON public.agriculture_finance_transactions (organization_id, farm_id);

CREATE INDEX ix_agriculture_harvests_org_date ON public.agriculture_harvests (organization_id, harvest_date);

CREATE INDEX ix_agriculture_harvests_org_parcel ON public.agriculture_harvests (organization_id, parcel_id);

CREATE INDEX ix_agriculture_parcels_org_active ON public.agriculture_parcels (organization_id, is_active);

CREATE INDEX ix_agriculture_parcels_org_farm ON public.agriculture_parcels (organization_id, farm_id);

CREATE INDEX ix_communication_posts_org_status_date ON public.communication_posts (organization_id, status, scheduled_date);

CREATE INDEX ix_hr_absence_org_status_date ON public.hr_absence_requests (organization_id, status, start_date);

CREATE INDEX ix_hr_absence_user_date ON public.hr_absence_requests (user_id, start_date);

CREATE INDEX ix_hr_payroll_org_period ON public.hr_payroll_records (organization_id, pay_year, pay_month);

CREATE INDEX ix_livestock_animals_org_species ON public.livestock_animals (organization_id, species);

CREATE INDEX ix_livestock_animals_org_status ON public.livestock_animals (organization_id, status);

CREATE INDEX ix_livestock_facilities_org_active ON public.livestock_facilities (organization_id, is_active);

CREATE INDEX ix_livestock_finance_org_date ON public.livestock_finance_transactions (organization_id, transaction_date);

CREATE INDEX ix_livestock_groups_org_species ON public.livestock_groups (organization_id, species);

CREATE INDEX ix_livestock_records_org_due_date ON public.livestock_records (organization_id, next_due_date);

CREATE INDEX ix_livestock_records_org_type_date ON public.livestock_records (organization_id, record_type, event_date);

CREATE INDEX ix_memberships_organization_id ON public.memberships (organization_id);

CREATE INDEX ix_memberships_user_id ON public.memberships (user_id);

CREATE INDEX ix_operation_task_updates_task_created ON public.operation_task_updates (task_id, created_at);

CREATE INDEX ix_operation_tasks_org_due_date ON public.operation_tasks (organization_id, due_date);

CREATE INDEX ix_operation_tasks_org_status ON public.operation_tasks (organization_id, status);

CREATE INDEX ix_products_org_public ON public.products (organization_id, is_active, is_published);

CREATE INDEX ix_sales_customers_org_name ON public.sales_customers (organization_id, name);

CREATE INDEX ix_sales_customers_org_phone ON public.sales_customers (organization_id, phone);

CREATE INDEX ix_sales_order_items_order_id ON public.sales_order_items (order_id);

CREATE INDEX ix_sales_order_status_events_order_created ON public.sales_order_status_events (order_id, created_at);

CREATE INDEX ix_sales_orders_org_date ON public.sales_orders (organization_id, order_date);

CREATE INDEX ix_stock_items_org_source ON public.stock_items (organization_id, source);

CREATE INDEX ix_stock_movements_org_item_date ON public.stock_movements (organization_id, stock_item_id, movement_date);

INSERT INTO public.alembic_version (version_num) VALUES ('0022_hidden_organization_modules');

COMMIT;
