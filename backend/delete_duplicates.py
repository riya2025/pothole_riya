import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.orm import Session
from app.database import engines, sessions
from app.models.issue import Issue
from app.models.report import Report

print("Starting deduplication process...")

for city, db_session in sessions.items():
    print(f"\nProcessing database: {city}")
    db = db_session()
    
    try:
        # We order by created_at so the oldest report is kept
        reports = db.query(Report).order_by(Report.created_at.asc()).all()
        
        seen = {}
        deleted_reports = 0
        deleted_issues_dict = {}
        
        for r in reports:
            # Duplicate definition: Same user_id and same issue_id
            key = (r.user_id, r.issue_id)
            if key in seen:
                db.delete(r)
                deleted_reports += 1
                deleted_issues_dict[r.issue_id] = deleted_issues_dict.get(r.issue_id, 0) + 1
                print(f"  Deleted duplicate Report ID {r.id} for Issue {r.issue_id} (User {r.user_id})")
            else:
                seen[key] = r.id
                
        # Update issue report counts to reflect accurate numbers
        for issue_id, count in deleted_issues_dict.items():
            issue = db.query(Issue).filter(Issue.id == issue_id).first()
            if issue:
                issue.report_count = max(1, issue.report_count - count)
                db.add(issue)
        
        db.commit()
        print(f"Finished {city}: Deleted {deleted_reports} duplicate reports.")
        
    except Exception as e:
        print(f"Error processing {city}: {e}")
        db.rollback()
    finally:
        db.close()

print("\nDeduplication completed.")
