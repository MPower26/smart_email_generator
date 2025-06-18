@router.post("/settings/update_intervals")
def update_intervals(followup_days: int, lastchance_days: int, user: User = Depends(), db: Session = Depends(get_db)):
    user.followup_interval_days = followup_days
    user.lastchance_interval_days = lastchance_days
    db.commit()
    return {"success": True}
