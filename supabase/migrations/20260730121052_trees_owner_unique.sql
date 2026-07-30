-- Один пользователь — одно дерево. Инвариант держит БД, а не только код:
-- это делает ensureTree безопасным при гонке двух одновременных запросов и
-- делает .maybeSingle() в loadTree доказуемо корректным.
alter table trees add constraint trees_owner_unique unique (owner_id);

-- Уникальное ограничение создаёт свой индекс, поэтому прежний неуникальный
-- становится избыточным.
drop index if exists trees_owner_idx;
