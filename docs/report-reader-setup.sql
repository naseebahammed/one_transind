-- Read-only login for Excel / Power BI. Run ONCE by the database administrator, after migration 011 has been applied.
-- psql asks for the new password on screen, so it is never saved in a file. app_user = the database user the app connects with.
-- Run:  psql -h [host] -U [admin-user] -d [database] -v app_user=[app-user] -f docs/report-reader-setup.sql

CREATE ROLE report_reader LOGIN;
\password report_reader

GRANT USAGE ON SCHEMA rpt TO report_reader;
GRANT SELECT ON ALL TABLES IN SCHEMA rpt TO report_reader;
-- Views added by later migrations are created by the app's user, so they are granted automatically only with FOR ROLE.
ALTER DEFAULT PRIVILEGES FOR ROLE :"app_user" IN SCHEMA rpt GRANT SELECT ON TABLES TO report_reader;

-- Views run with their owner's rights, so report_reader can read the rpt views without any access to app.* or stg.*.
