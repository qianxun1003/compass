#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
安全合并爬取数据到主Excel文件
只添加新数据，不覆盖现有数据
"""
import pandas as pd
from pathlib import Path
from datetime import datetime
import shutil

# 文件路径
MAIN_EXCEL = Path(__file__).parent.parent / "学部学校一览表.xlsx"
CRAWLED_EXCEL = Path(__file__).parent.parent / "crawled_data" / "crawled_schools_review.xlsx"
BACKUP_DIR = Path(__file__).parent.parent / "backups"

def backup_excel():
    """备份主Excel文件"""
    if not BACKUP_DIR.exists():
        BACKUP_DIR.mkdir(parents=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"学部学校一览表_{timestamp}.xlsx"
    shutil.copy2(MAIN_EXCEL, backup_path)
    print(f"✅ 已备份主Excel到: {backup_path}")
    return backup_path

def is_duplicate(row1, row2):
    """判断两条记录是否重复（基于大学+学部）"""
    return (
        row1.get("大学", "").strip() == row2.get("大学", "").strip() and
        row1.get("学部", "").strip() == row2.get("学部", "").strip()
    )

def merge_data():
    """合并数据"""
    if not MAIN_EXCEL.exists():
        print(f"❌ 找不到主Excel文件: {MAIN_EXCEL}")
        return False
    
    if not CRAWLED_EXCEL.exists():
        print(f"❌ 找不到爬取数据文件: {CRAWLED_EXCEL}")
        print(f"   请先运行爬虫并审核数据")
        return False
    
    # 备份
    backup_path = backup_excel()
    
    # 读取主Excel
    print("📖 读取主Excel文件...")
    main_df = pd.read_excel(MAIN_EXCEL, sheet_name="学校总览")
    print(f"   现有数据: {len(main_df)} 条")
    
    # 读取爬取数据
    print("📖 读取爬取数据...")
    crawled_df = pd.read_excel(CRAWLED_EXCEL, sheet_name="学校总览")
    print(f"   爬取数据: {len(crawled_df)} 条")
    
    # 找出新数据（不重复的）
    new_rows = []
    duplicate_count = 0
    
    for _, crawled_row in crawled_df.iterrows():
        is_dup = False
        for _, main_row in main_df.iterrows():
            if is_duplicate(crawled_row.to_dict(), main_row.to_dict()):
                is_dup = True
                duplicate_count += 1
                break
        
        if not is_dup:
            new_rows.append(crawled_row)
    
    print(f"\n📊 统计:")
    print(f"   - 新数据: {len(new_rows)} 条")
    print(f"   - 重复数据: {duplicate_count} 条（已跳过）")
    
    if len(new_rows) == 0:
        print("\n✅ 没有新数据需要合并")
        return True
    
    # 确认合并
    print(f"\n⚠️  准备添加 {len(new_rows)} 条新数据到主Excel")
    confirm = input("确认合并？(y/n): ").strip().lower()
    
    if confirm != 'y':
        print("❌ 已取消合并")
        return False
    
    # 合并数据
    new_df = pd.DataFrame(new_rows)
    merged_df = pd.concat([main_df, new_df], ignore_index=True)
    
    # 保存
    with pd.ExcelWriter(MAIN_EXCEL, engine='openpyxl') as writer:
        merged_df.to_excel(writer, sheet_name="学校总览", index=False)
    
    print(f"\n✅ 合并完成！")
    print(f"   - 原数据: {len(main_df)} 条")
    print(f"   - 新增: {len(new_rows)} 条")
    print(f"   - 总计: {len(merged_df)} 条")
    print(f"   - 备份文件: {backup_path}")
    print(f"\n📝 下一步: 运行 python3 export_school_data.py 更新JSON文件")
    
    return True

if __name__ == "__main__":
    print("=" * 60)
    print("数据合并工具")
    print("=" * 60)
    print()
    
    merge_data()
