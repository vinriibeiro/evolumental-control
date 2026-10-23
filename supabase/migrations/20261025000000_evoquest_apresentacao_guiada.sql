-- =====================================================================
-- EVoLuMentaL Control — EvoQuest: apresentação guiada
-- Migração 20261025000000_evoquest_apresentacao_guiada
--
-- Somente catálogo (idempotente):
-- * tutorial:board passa a ser a ESCOLHA da primeira cidade no Quadro de
--   Missões (sem resposta a conferir e sem recompensa);
-- * o antigo desafio SQL do quadro vira a missão opcional side_board:query,
--   com o mesmo hash de resposta e a mesma recompensa.
-- =====================================================================

-- ── Catálogo (GERADO a partir de src/features/evoquest/content) ──────────
-- <catalogo>
insert into public.game_quest_steps (key, quest_id, position, requires, xp, coins, check_hash, require_answer) values
  ('tutorial:talk_iara', 'tutorial', 0, null, 0, 0, null, null),
  ('tutorial:board', 'tutorial', 1, 'tutorial:talk_iara', 0, 0, null, null),
  ('tutorial:report', 'tutorial', 2, 'tutorial:board', 0, 0, null, null),
  ('tutorial:trip', 'tutorial', 3, 'tutorial:report', 0, 0, null, null),
  ('side_board:query', 'side_board', 0, null, 30, 10, 'be3b9f5ae488754dce58547dc501d2fe43abb1343985e493932720b6920feab7', null),
  ('sql_main:travel', 'sql_main', 0, null, 0, 0, null, null),
  ('sql_main:talk_maya', 'sql_main', 1, 'sql_main:travel', 0, 0, null, null),
  ('sql_main:door', 'sql_main', 2, 'sql_main:talk_maya', 40, 5, 'd5b4cd5c0fee70045ce6063f1925e539e210703f1f27ddec2121fbbb8e8df401', null),
  ('sql_main:talk_bras', 'sql_main', 3, 'sql_main:door', 0, 0, null, null),
  ('sql_main:logs', 'sql_main', 4, 'sql_main:talk_bras', 60, 5, '33a7c3e0b423a02f274508878a611f73cc8a7875152dce669f8ecd2607a5cf6d', null),
  ('sql_main:who', 'sql_main', 5, 'sql_main:logs', 80, 10, '4f3eff0d16439bb41ddb663f31635abd5b661ea45006ee81829398dfd013131d', null),
  ('sql_main:sentinel', 'sql_main', 6, 'sql_main:who', 120, 15, 'b61eb51eb7cfabb4e182bed833f9a8e633068e91fcb75bf63c9214659e2f9adf', null),
  ('sql_main:talk_ze', 'sql_main', 7, 'sql_main:sentinel', 0, 0, null, null),
  ('sql_main:power', 'sql_main', 8, 'sql_main:talk_ze', 50, 5, 'fdb04ccfdd19a99e96a714aa4d61956b91ab49ac553ed1bfc50ca9696471a32d', null),
  ('sql_main:boss_logs', 'sql_main', 9, 'sql_main:power', 70, 5, '9df7caba2ae13e97119653f1e84bc6a9e4663e98ed5a397f17ac8f68a9686d16', null),
  ('sql_main:boss_join', 'sql_main', 10, 'sql_main:boss_logs', 90, 10, 'd5e95d68d5543aae7c1bb8f5069de2ccd2b443dc14fe6d16445c2d1a31a3965f', null),
  ('sql_main:boss_agg', 'sql_main', 11, 'sql_main:boss_join', 110, 10, '2682fee5af69884782c4e84bcd933554c893bc2612dec97f069251a40412f543', null),
  ('sql_main:boss_fix', 'sql_main', 12, 'sql_main:boss_agg', 160, 25, '41637736b1d6b40e4ca4eb4a81b735b62168675aed43f580141037d0538ef6de', null),
  ('sql_main:finale', 'sql_main', 13, 'sql_main:boss_fix', 100, 40, null, null),
  ('side_badges:find', 'side_badges', 0, null, 70, 10, 'fcf1ccbe5eceb152ad9d092beb6175a9d69c138b1cfb35027f71c2888353ec12', null),
  ('side_badges:report', 'side_badges', 1, 'side_badges:find', 0, 0, null, null),
  ('side_cafe:find', 'side_cafe', 0, null, 60, 10, 'aa4a1c6d3da290bb6ce724570e5d8586f6776a5a5d1a0afb7bffd7504002743d', null),
  ('side_cafe:report', 'side_cafe', 1, 'side_cafe:find', 0, 0, null, null),
  ('city_lab_aurora:arrive', 'city_lab_aurora', 0, null, 0, 0, null, null),
  ('city_lab_aurora:mentor', 'city_lab_aurora', 1, 'city_lab_aurora:arrive', 0, 0, null, null),
  ('city_lab_aurora:unit_1', 'city_lab_aurora', 2, 'city_lab_aurora:mentor', 60, 25, null, 'python.u1.boss'),
  ('city_lab_aurora:unit_2', 'city_lab_aurora', 3, 'city_lab_aurora:unit_1', 60, 25, null, 'python.u2.boss'),
  ('city_lab_aurora:unit_3', 'city_lab_aurora', 4, 'city_lab_aurora:unit_2', 60, 25, null, 'python.u3.boss'),
  ('city_lab_aurora:finale', 'city_lab_aurora', 5, 'city_lab_aurora:unit_3', 100, 35, null, null),
  ('city_language_tower:arrive', 'city_language_tower', 0, null, 0, 0, null, null),
  ('city_language_tower:mentor', 'city_language_tower', 1, 'city_language_tower:arrive', 0, 0, null, null),
  ('city_language_tower:unit_1', 'city_language_tower', 2, 'city_language_tower:mentor', 60, 25, null, 'ingles.u1.boss'),
  ('city_language_tower:unit_2', 'city_language_tower', 3, 'city_language_tower:unit_1', 60, 25, null, 'ingles.u2.boss'),
  ('city_language_tower:unit_3', 'city_language_tower', 4, 'city_language_tower:unit_2', 60, 25, null, 'ingles.u3.boss'),
  ('city_language_tower:finale', 'city_language_tower', 5, 'city_language_tower:unit_3', 100, 35, null, null),
  ('city_logic_temple:arrive', 'city_logic_temple', 0, null, 0, 0, null, null),
  ('city_logic_temple:mentor', 'city_logic_temple', 1, 'city_logic_temple:arrive', 0, 0, null, null),
  ('city_logic_temple:unit_1', 'city_logic_temple', 2, 'city_logic_temple:mentor', 60, 25, null, 'logica.u1.boss'),
  ('city_logic_temple:unit_2', 'city_logic_temple', 3, 'city_logic_temple:unit_1', 60, 25, null, 'logica.u2.boss'),
  ('city_logic_temple:unit_3', 'city_logic_temple', 4, 'city_logic_temple:unit_2', 60, 25, null, 'logica.u3.boss'),
  ('city_logic_temple:finale', 'city_logic_temple', 5, 'city_logic_temple:unit_3', 100, 35, null, null),
  ('city_observatory:arrive', 'city_observatory', 0, null, 0, 0, null, null),
  ('city_observatory:mentor', 'city_observatory', 1, 'city_observatory:arrive', 0, 0, null, null),
  ('city_observatory:unit_1', 'city_observatory', 2, 'city_observatory:mentor', 60, 25, null, 'estatistica.u1.boss'),
  ('city_observatory:unit_2', 'city_observatory', 3, 'city_observatory:unit_1', 60, 25, null, 'estatistica.u2.boss'),
  ('city_observatory:unit_3', 'city_observatory', 4, 'city_observatory:unit_2', 60, 25, null, 'estatistica.u3.boss'),
  ('city_observatory:finale', 'city_observatory', 5, 'city_observatory:unit_3', 100, 35, null, null),
  ('city_archive:arrive', 'city_archive', 0, null, 0, 0, null, null),
  ('city_archive:mentor', 'city_archive', 1, 'city_archive:arrive', 0, 0, null, null),
  ('city_archive:unit_1', 'city_archive', 2, 'city_archive:mentor', 60, 25, null, 'portugues.u1.boss'),
  ('city_archive:unit_2', 'city_archive', 3, 'city_archive:unit_1', 60, 25, null, 'portugues.u2.boss'),
  ('city_archive:unit_3', 'city_archive', 4, 'city_archive:unit_2', 60, 25, null, 'portugues.u3.boss'),
  ('city_archive:finale', 'city_archive', 5, 'city_archive:unit_3', 100, 35, null, null),
  ('city_command_tower:arrive', 'city_command_tower', 0, null, 0, 0, null, null),
  ('city_command_tower:mentor', 'city_command_tower', 1, 'city_command_tower:arrive', 0, 0, null, null),
  ('city_command_tower:unit_1', 'city_command_tower', 2, 'city_command_tower:mentor', 60, 25, null, 'dax.u1.boss'),
  ('city_command_tower:unit_2', 'city_command_tower', 3, 'city_command_tower:unit_1', 60, 25, null, 'dax.u2.boss'),
  ('city_command_tower:unit_3', 'city_command_tower', 4, 'city_command_tower:unit_2', 60, 25, null, 'dax.u3.boss'),
  ('city_command_tower:finale', 'city_command_tower', 5, 'city_command_tower:unit_3', 100, 35, null, null),
  ('city_refinery:arrive', 'city_refinery', 0, null, 0, 0, null, null),
  ('city_refinery:mentor', 'city_refinery', 1, 'city_refinery:arrive', 0, 0, null, null),
  ('city_refinery:unit_1', 'city_refinery', 2, 'city_refinery:mentor', 60, 25, null, 'm.u1.boss'),
  ('city_refinery:unit_2', 'city_refinery', 3, 'city_refinery:unit_1', 60, 25, null, 'm.u2.boss'),
  ('city_refinery:unit_3', 'city_refinery', 4, 'city_refinery:unit_2', 60, 25, null, 'm.u3.boss'),
  ('city_refinery:finale', 'city_refinery', 5, 'city_refinery:unit_3', 100, 35, null, null)
on conflict (key) do update set quest_id = excluded.quest_id, position = excluded.position, requires = excluded.requires, xp = excluded.xp, coins = excluded.coins, check_hash = excluded.check_hash, require_answer = excluded.require_answer;

insert into public.game_shop_items (id, kind, name, price) values
  ('ticket_data_city', 'ticket', 'Passagem para Cidade dos Dados', 80),
  ('ticket_lab_aurora', 'ticket', 'Passagem para Aurora', 80),
  ('ticket_language_tower', 'ticket', 'Passagem para Babel', 80),
  ('ticket_logic_temple', 'ticket', 'Passagem para Silogia', 80),
  ('ticket_observatory', 'ticket', 'Passagem para Gaussópolis', 80),
  ('ticket_archive', 'ticket', 'Passagem para Vernácula', 80),
  ('ticket_command_tower', 'ticket', 'Passagem para Medida Certa', 80),
  ('ticket_refinery', 'ticket', 'Passagem para Pipeline', 80)
on conflict (id) do update set kind = excluded.kind, name = excluded.name, price = excluded.price;
-- </catalogo>
