#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
从飞书导出的审核表格合并回主Excel
处理流程：
1. 读取飞书导出的审核表格（Excel或CSV）
2. 提取已审核/已确认的记录
3. 合并到主Excel（优先使用审核后的数据）
"""
import pandas as pd
from pathlib import Path
from datetime import datetime
import shutil

# 文件路径
MAIN_EXCEL = Path(__file__).parent.parent / "学部学校一览表.xlsx"
REVIEWED_EXCEL = Path(__file__).parent.parent / "crawled_data" / "审核表格_完整版.xlsx"  # 飞书导出后的文件
BACKUP_DIR = Path(__file__).parent.parent / "backups"

def backup_excel():
    """备份主Excel"""
    if not BACKUP_DIR.exists():
        BACKUP_DIR.mkdir(parents=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"学部学校一览表_{timestamp}.xlsx"
    shutil.copy2(MAIN_EXCEL, backup_path)
    print(f"✅ 已备份主Excel到: {backup_path}")
    return backup_path

def merge_reviewed_data():
    """合并审核后的数据"""
    print("=" * 60)
    print("合并审核后的数据")
    print("=" * 60)
    print()
    
    # 检查文件
    if not MAIN_EXCEL.exists():
        print(f"❌ 找不到主Excel文件: {MAIN_EXCEL}")
        return False
    
    # 检查审核表格（可能是Excel或CSV）
    reviewed_file = None
    if REVIEWED_EXCEL.exists():
        reviewed_file = REVIEWED_EXCEL
        print(f"📖 找到审核表格（Excel）: {reviewed_file}")
    else:
        csv_file = Path(__file__).parent.parent / "crawled_data" / "审核表格_完整版.csv"
        if csv_file.exists():
            reviewed_file = csv_file
            print(f"📖 找到审核表格（CSV）: {reviewed_file}")
        else:
            print(f"❌ 找不到审核表格文件")
            print(f"   请将飞书导出的文件保存为: {REVIEWED_EXCEL} 或 {csv_file}")
            return False
    
    # 备份主Excel
    backup_path = backup_excel()
    
    # 读取主Excel
    print("📖 读取主Excel...")
    df_main = pd.read_excel(MAIN_EXCEL, sheet_name="学校总览")
    print(f"   主Excel记录数: {len(df_main)} 条")
    
    # 读取审核表格
    print("📖 读取审核表格...")
    if reviewed_file.suffix == '.csv':
        df_reviewed = pd.read_csv(reviewed_file, encoding='utf-8-sig')
    else:
        df_reviewed = pd.read_excel(reviewed_file, sheet_name="审核表格")
    print(f"   审核表格记录数: {len(df_reviewed)} 条")
    print()
    
    # 筛选已审核/已确认的记录
    print("🔍 筛选已审核的记录...")
    # 审核状态列可能的值：已审核/已确认/需修改
    reviewed_mask = df_reviewed["审核状态"].isin(["已审核", "已确认"])
    df_confirmed = df_reviewed[reviewed_mask].copy()
    print(f"   已审核/已确认的记录: {len(df_confirmed)} 条")
    
    if len(df_confirmed) == 0:
        print("⚠️  没有找到已审核/已确认的记录")
        print("   请确保审核状态列中包含'已审核'或'已确认'的记录")
        return False
    
    print()
    
    # 合并策略：优先使用审核后的数据
    print("🔀 合并数据...")
    print("   策略：优先使用审核后的数据，保留主Excel中审核表格没有的记录")
    print()
    
    # 获取主Excel的列（只更新主Excel中存在的列）
    main_columns = list(df_main.columns)
    
    # 创建合并后的DataFrame
    merged_df = df_main.copy()
    
    # 更新记录数统计
    update_count = 0
    add_count = 0
    
    # 遍历审核后的记录
    for _, reviewed_row in df_confirmed.iterrows():
        uni = reviewed_row.get("大学", "")
        dept = reviewed_row.get("学部", "")
        
        if not uni or pd.isna(uni):
            continue
        
        # 查找主Excel中匹配的记录（基于大学+学部）
        mask = (merged_df["大学"] == uni) & (merged_df["学部"] == dept)
        matching_rows = merged_df[mask]
        
        if len(matching_rows) > 0:
            # 更新现有记录
            for idx in matching_rows.index:
                # 只更新主Excel中存在的列，且审核表格中有值的字段
                for col in main_columns:
                    if col in reviewed_row.index:
                        reviewed_val = reviewed_row[col]
                        # 如果审核表格中的值不为空，则更新
                        if pd.notna(reviewed_val) and str(reviewed_val).strip():
                            merged_df.at[idx, col] = reviewed_val
                update_count += 1
        else:
            # 添加新记录（只添加主Excel列中存在的字段）
            new_row = {}
            for col in main_columns:
                if col in reviewed_row.index:
                    new_row[col] = reviewed_row[col]
                else:
                    new_row[col] = ""
            
            merged_df = pd.concat([merged_df, pd.DataFrame([new_row])], ignore_index=True)
            add_count += 1
    
    print(f"📊 合并统计:")
    print(f"   - 更新记录: {update_count} 条")
    print(f"   - 新增记录: {add_count} 条")
    print(f"   - 总记录数: {len(merged_df)} 条")
    print()
    
    # 确认保存
    print(f"⚠️  准备保存合并后的数据")
    confirm = input("确认保存？(y/n): ").strip().lower()
    
    if confirm != 'y':
        print("❌ 已取消保存")
        return False
    
    # 保存
    with pd.ExcelWriter(MAIN_EXCEL, engine='openpyxl') as writer:
        merged_df.to_excel(writer, sheet_name="学校总览", index=False)
    
    print()
    print("✅ 合并完成！")
    print(f"   - 备份文件: {backup_path}")
    print(f"   - 更新记录: {update_count} 条")
    print(f"   - 新增记录: {add_count} 条")
    print()
    print("📝 下一步:")
    print("   1. 检查合并后的Excel数据")
    print("   2. 运行: python3 export_school_data.py")
    print("   3. 更新JSON文件供前端使用")
    
    return True

if __name__ == "__main__":
    merge_reviewed_data()
