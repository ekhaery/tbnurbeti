-- seed feature
insert into features (name, slug) values ('Suppliers', 'suppliers');

-- admin: full access
insert into role_permissions (role_id, feature_id, can_view, can_create, can_edit, can_delete)
values (
  (select id from roles where name = 'admin'),
  (select id from features where slug = 'suppliers'),
  true, true, true, true
);

-- user: no access
insert into role_permissions (role_id, feature_id, can_view, can_create, can_edit, can_delete)
values (
  (select id from roles where name = 'user'),
  (select id from features where slug = 'suppliers'),
  false, false, false, false
);
