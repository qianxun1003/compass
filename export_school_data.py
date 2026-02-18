#!/usr/bin/env python3
"""从 Excel 导出完整学校数据为 JSON，供 compass_application 抓取补全日期。
Excel 更新后请运行: python3 export_school_data.py
预览时需用本地服务器（如 python3 -m http.server 8000）以支持 fetch。"""
import json
import pandas as pd
from pathlib import Path

EXCEL_PATH = Path(__file__).parent / "学部学校一览表.xlsx"
OUTPUT_JSON = Path(__file__).parent / "学校总览.json"
OUTPUT_JSON_ASCII = Path(__file__).parent / "school-master.json"  # 部署用英文路径，避免 Render 等环境中文文件名不可用
OUTPUT_CSV = Path(__file__).parent / "学校总览.csv"

COLUMN_MAP = {
    "大学": "name",
    "学部": "department",
    "学科": "major",
    "位置": "region",
    "文理": "bunri",
    "方式": "selectionMethod",
    "第几期": "period",
    "併願": "combined",
    "能使用EJU": "ejuPeriod",
    "需要EJU科目": "ejuSubjects",
    "英语": "english",
    "JLPT": "jlpt",
    "网上出愿开始时间": "mailStart",
    "网上出愿截止时间": "mailEnd",
    "邮寄开始时间": "mailStartDate",
    "邮寄截止时间": "mailEndDate",
    "必着/消印": "mailEndNote",
    "校内考形式": "examFormat",
    "校内考时间1": "examDate",
    "校内考时间2": "examDate2",
    "发榜时间": "announcementDate",
    # 特殊成绩要求（硬性条件，格式：科目名:分数，多个要求用逗号分隔，如：数学1:150,日语:300）
    "特殊成绩要求": "specialRequirements",
}


def to_js_value(v):
    if pd.isna(v):
        return None
    s = str(v).strip()
    if not s:
        return None
    if hasattr(v, "isoformat") and hasattr(v, "year"):  # datetime
        return v.strftime("%Y-%m-%d %H:%M:%S") if hasattr(v, "strftime") else str(v)
    return s


def main():
    df = pd.read_excel(EXCEL_PATH, sheet_name="学校总览")
    rows = []
    for _, r in df.iterrows():
        row = {}
        for excel_col, js_key in COLUMN_MAP.items():
            if excel_col in df.columns:
                val = to_js_value(r[excel_col])
                if val is not None:
                    row[js_key] = val
        if row.get("name"):
            rows.append(row)
    data = {"data": rows}
    json_str = json.dumps(data, ensure_ascii=False, indent=0)
    OUTPUT_JSON.write_text(json_str, encoding="utf-8")
    OUTPUT_JSON_ASCII.write_text(json_str, encoding="utf-8")
    print(f"已导出 {len(rows)} 条到 {OUTPUT_JSON} 与 {OUTPUT_JSON_ASCII}")
    # 同时导出 CSV 供 compass_search 使用
    cols = ["大学", "学部", "学科", "位置", "文理", "方式", "第几期", "併願", "能使用EJU", "需要EJU科目", "英语", "JLPT", "校内考形式", "网上出愿开始时间", "网上出愿截止时间", "邮寄开始时间", "邮寄截止时间", "校内考时间1", "校内考时间2", "发榜时间"]
    import csv
    with OUTPUT_CSV.open("w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(cols)
        for r in rows:
            w.writerow([r.get(COLUMN_MAP.get(c, c), "") or "" for c in cols])
    print(f"已导出 CSV 到 {OUTPUT_CSV}")


if __name__ == "__main__":
    main()
