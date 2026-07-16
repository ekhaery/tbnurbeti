update transactions set is_paid = true where is_paid is distinct from true;
update dev.transactions set is_paid = true where is_paid is distinct from true;
