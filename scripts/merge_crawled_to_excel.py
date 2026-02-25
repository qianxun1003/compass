#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
将统一爬取框架的输出数据合并到现有Excel结构
智能合并策略：优先使用爬取数据，保留现有数据（如果爬取数据缺失）
"""
import pandas as pd
import json
from pathlib import Path
from datetime import datetime
import shutil

# 文件路径
EXCEL_PATH = Path(__file__).parent.parent / "学部学校一览表.xlsx"
CRAWLED_DATA_DIR = Path(__file__).parent.parent / "crawled_data" / "unified_crawl_results"
BACKUP_DIR = Path(__file__).parent.parent / "backups"

def backup_excel():
    """备份Excel文件"""
    if not BACKUP_DIR.exists():
        BACKUP_DIR.mkdir(parents=True)
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = BACKUP_DIR / f"学部学校一览表_{timestamp}.xlsx"
    shutil.copy2(EXCEL_PATH, backup_path)
    print(f"✅ 已备份Excel到: {backup_path}")
    return backup_path

def load_crawled_data():
    """加载爬取的数据"""
    # 查找最新的爬取结果文件
    json_files = list(CRAWLED_DATA_DIR.glob("crawl_results_*.json"))
    if not json_files:
        print(f"❌ 找不到爬取结果文件，请先运行爬虫")
        return None
    
    # 使用最新的文件
    latest_file = max(json_files, key=lambda p: p.stat().st_mtime)
    print(f"📖 读取爬取结果: {latest_file}")
    
    with open(latest_file, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    print(f"   找到 {len(data)} 条爬取数据")
    return data

def map_crawled_to_excel_format(crawled_item):
    """
    将爬取数据映射到Excel格式
    """
    excel_row = {}
    
    # 基础信息
    basic = crawled_item.get("基础信息", {})
    excel_row["大学"] = crawled_item.get("university", "")
    excel_row["学部"] = basic.get("学部") or crawled_item.get("department", "")
    excel_row["学科"] = basic.get("学科", "")
    excel_row["位置"] = basic.get("地理位置", "")
    excel_row["文理"] = basic.get("文理", "")
    
    # 期数和选考方式（需要标准化，这里先保存原始表述）
    period_info = crawled_item.get("期数信息", {})
    excel_row["第几期"] = period_info.get("原始表述", "")
    
    method_info = crawled_item.get("选考方式", {})
    excel_row["方式"] = method_info.get("原始表述", "")
    
    # 校内考信息
    exam_info = crawled_item.get("校内考信息", {})
    exam_format_parts = []
    if exam_info.get("一次选考", {}).get("形式"):
        exam_format_parts.append(exam_info["一次选考"]["形式"])
    if exam_info.get("二次选考", {}).get("形式"):
        exam_format_parts.append(exam_info["二次选考"]["形式"])
    excel_row["校内考形式"] = ", ".join(exam_format_parts) if exam_format_parts else ""
    excel_row["校内考时间1"] = exam_info.get("一次选考", {}).get("时间", "")
    excel_row["校内考时间2"] = exam_info.get("二次选考", {}).get("时间", "")
    
    # 出愿时间
    time_info = crawled_item.get("出愿时间", {})
    excel_row["网上出愿开始时间"] = time_info.get("网上出愿开始", "")
    excel_row["网上出愿截止时间"] = time_info.get("网上出愿截止", "")
    excel_row["邮寄开始时间"] = time_info.get("邮寄开始", "")
    excel_row["邮寄截止时间"] = time_info.get("邮寄截止", "")
    excel_row["必着/消印"] = time_info.get("必着/消印", "")
    
    # EJU和成绩要求
    score_info = crawled_item.get("成绩要求", {})
    eju_info = score_info.get("EJU科目", {})
    excel_row["需要EJU科目"] = ", ".join(eju_info.get("需要的科目", []))
    excel_row["能使用EJU"] = ""  # 需要从其他信息提取
    
    english_info = score_info.get("英语", {})
    excel_row["英语"] = english_info.get("是否需要", "")
    
    jlpt_info = score_info.get("JLPT", {})
    excel_row["JLPT"] = jlpt_info.get("是否需要", "")
    
    # 新字段（需要添加到Excel）
    excel_row["英语成绩类型"] = english_info.get("成绩类型", "")
    excel_row["英语成绩推荐分数"] = english_info.get("推荐分数", "")
    excel_row["JLPT等级"] = jlpt_info.get("等级要求", "")
    excel_row["JLPT分数要求"] = jlpt_info.get("分数要求", "")
    excel_row["EJU推荐分数"] = json.dumps(eju_info.get("推荐分数", {}), ensure_ascii=False) if eju_info.get("推荐分数") else ""
    
    # 出愿材料（新字段）
    materials_info = crawled_item.get("出愿材料", {})
    excel_row["出愿材料"] = ", ".join(materials_info.get("材料清单", []))
    excel_row["推荐信要求"] = materials_info.get("推荐信要求", "")
    excel_row["出愿流程"] = materials_info.get("出愿流程", "")
    
    # 合格情况（新字段）
    admission_info = crawled_item.get("合格情况", {})
    ratio_info = admission_info.get("报录比", {})
    if ratio_info:
        excel_row["报录比（2024）"] = ratio_info.get("2024", {}).get("比例", "")
        excel_row["报录比（2023）"] = ratio_info.get("2023", {}).get("比例", "")
    
    return excel_row

def merge_data():
    """合并数据"""
    print("=" * 60)
    print("数据合并工具")
    print("=" * 60)
    print()
    
    if not EXCEL_PATH.exists():
        print(f"❌ 找不到Excel文件: {EXCEL_PATH}")
        return False
    
    # 加载爬取数据
    crawled_data = load_crawled_data()
    if not crawled_data:
        return False
    
    # 备份Excel
    backup_path = backup_excel()
    
    # 读取现有Excel
    print("📖 读取现有Excel...")
    df_existing = pd.read_excel(EXCEL_PATH, sheet_name="学校总览")
    print(f"   现有数据: {len(df_existing)} 条")
    print()
    
    # 将爬取数据转换为DataFrame
    print("🔄 转换爬取数据...")
    crawled_rows = []
    for item in crawled_data:
        row = map_crawled_to_excel_format(item)
        if row.get("大学"):
            crawled_rows.append(row)
    
    if not crawled_rows:
        print("❌ 没有有效的爬取数据")
        return False
    
    df_crawled = pd.DataFrame(crawled_rows)
    print(f"   爬取数据: {len(df_crawled)} 条")
    print()
    
    # 智能合并策略
    print("🔀 合并数据...")
    print("   策略：优先使用爬取数据，保留现有数据（如果爬取数据缺失）")
    print()
    
    # 创建合并后的DataFrame
    # 以现有Excel的列为基础
    merged_df = df_existing.copy()
    
    # 为每个大学/学部更新数据
    update_count = 0
    add_count = 0
    
    for _, crawled_row in df_crawled.iterrows():
        uni = crawled_row.get("大学", "")
        dept = crawled_row.get("学部", "")
        
        if not uni:
            continue
        
        # 查找现有数据中是否有匹配的记录
        mask = (merged_df["大学"] == uni) & (merged_df["学部"] == dept)
        matching_rows = merged_df[mask]
        
        if len(matching_rows) > 0:
            # 更新现有记录
            for idx in matching_rows.index:
                # 只更新爬取数据中有的字段（非空）
                for col in crawled_row.index:
                    if pd.notna(crawled_row[col]) and str(crawled_row[col]).strip():
                        merged_df.at[idx, col] = crawled_row[col]
                update_count += 1
        else:
            # 添加新记录
            merged_df = pd.concat([merged_df, pd.DataFrame([crawled_row])], ignore_index=True)
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
    with pd.ExcelWriter(EXCEL_PATH, engine='openpyxl') as writer:
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
    print("   3. 更新JSON文件")
    
    return True

if __name__ == "__main__":
    merge_data()
