-- SkillDrive 数据库初始化脚本
-- 仅用于手动部署，Docker Compose 部署无需此脚本
--
-- 使用方式：
--   psql -U postgres -f backend/scripts/init-db.sql
--
-- 或在 PostgreSQL 命令行中执行：
--   \i backend/scripts/init-db.sql

-- 创建数据库
CREATE DATABASE skilldrive;

-- 创建用户（请根据实际需求修改密码）
CREATE USER skilldrive WITH PASSWORD 'skilldrive';

-- 授权
GRANT ALL PRIVILEGES ON DATABASE skilldrive TO skilldrive;

-- 连接到 skilldrive 数据库并设置权限
\c skilldrive
GRANT ALL ON SCHEMA public TO skilldrive;

-- 提示信息
-- 数据库初始化完成，请执行以下命令进行迁移：
--   alembic -c backend/alembic.ini upgrade head