import sqlite3
import os

# Paths to databases
DB_DIR = r"c:\Users\hackathonuser5\Documents\Roopali\PotholeSegmentation\backend"
CIVIC_DB = os.path.join(DB_DIR, "civic.db")
HYDERABAD_DB = os.path.join(DB_DIR, "hyderabad.db")
BANGALORE_DB = os.path.join(DB_DIR, "bangalore.db")

def get_city_from_coords(lat, lng):
    # Bangalore bounds approximately
    if 12.5 <= lat <= 13.5 and 77.0 <= lng <= 78.0:
        return "bangalore"
    # Default to Hyderabad
    return "hyderabad"

def migrate():
    if not os.path.exists(CIVIC_DB):
        print(f"Source database {CIVIC_DB} not found.")
        return

    # Use dict_factory for easier access
    def dict_factory(cursor, row):
        d = {}
        for idx, col in enumerate(cursor.description):
            d[col[0]] = row[idx]
        return d

    src_conn = sqlite3.connect(CIVIC_DB)
    src_conn.row_factory = dict_factory
    src_cursor = src_conn.cursor()

    # Get all issues
    src_cursor.execute("SELECT * FROM issues")
    issues = src_cursor.fetchall()
    print(f"Found {len(issues)} issues in civic.db")

    # Connect to target databases
    hyd_conn = sqlite3.connect(HYDERABAD_DB)
    blr_conn = sqlite3.connect(BANGALORE_DB)
    hyd_cursor = hyd_conn.cursor()
    blr_cursor = blr_conn.cursor()

    for issue in issues:
        city = get_city_from_coords(issue['latitude'], issue['longitude'])
        target_conn = hyd_conn if city == "hyderabad" else blr_conn
        target_cursor = hyd_cursor if city == "hyderabad" else blr_cursor

        print(f"Migrating issue {issue['id']} to {city}...")

        # Insert issue
        target_cursor.execute(
            "INSERT INTO issues (type, status, latitude, longitude, address, report_count, created_at, updated_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (issue['type'], issue['status'], issue['latitude'], issue['longitude'], 
             issue['address'], issue['report_count'], issue['created_at'], issue['updated_at'])
        )
        new_issue_id = target_cursor.lastrowid

        # Get reports for this issue
        src_cursor.execute("SELECT * FROM reports WHERE issue_id = ?", (issue['id'],))
        reports = src_cursor.fetchall()
        for report in reports:
            target_cursor.execute(
                "INSERT INTO reports (issue_id, user_id, image_url, description, latitude, longitude, created_at) "
                "VALUES (?, ?, ?, ?, ?, ?, ?)",
                (new_issue_id, report['user_id'], report['image_url'], report['description'],
                 report['latitude'], report['longitude'], report['created_at'])
            )
        
        target_conn.commit()

    src_conn.close()
    hyd_conn.close()
    blr_conn.close()
    print("Migration complete.")

if __name__ == "__main__":
    migrate()
