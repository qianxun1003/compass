#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
创建完整的审核表格，供老师在飞书多维表格中审核
包含：现有Excel的所有字段 + 爬取的新字段 + 审核状态字段
"""
import pandas as pd
from pathlib import Path
from datetime import datetime

# 文件路径
EXCEL_PATH = Path(__file__).parent.parent / "学部学校一览表.xlsx"
OUTPUT_EXCEL = Path(__file__).parent.parent / "crawled_data" / "审核表格_完整版.xlsx"
OUTPUT_CSV = Path(__file__).parent.parent / "crawled_data" / "审核表格_完整版.csv"

def create_review_table():
    """创建完整的审核表格"""
    print("=" * 60)
    print("创建完整审核表格")
    print("=" * 60)
    print()
    
    # 读取现有Excel
    if not EXCEL_PATH.exists():
        print(f"❌ 找不到Excel文件: {EXCEL_PATH}")
        return False
    
    print("📖 读取现有Excel...")
    df = pd.read_excel(EXCEL_PATH, sheet_name="学校总览")
    print(f"   现有数据: {len(df)} 条")
    print(f"   现有字段: {len(df.columns)} 个")
    print()
    
    # 定义完整的字段列表（现有字段 + 新字段 + 审核字段）
    # 现有字段（保持原有顺序）
    existing_columns = list(df.columns)
    
    # 新字段（从爬取数据中获取）
    new_columns = [
        # 成绩要求详细字段
        "英语成绩类型",  # TOEFL/TOEIC/IELTS
        "英语成绩推荐分数",  # 具体分数要求
        "JLPT等级",  # N1/N2等
        "JLPT分数要求",  # 具体分数要求
        "EJU推荐分数",  # JSON格式，包含各科目推荐分数
        # 出愿材料详细字段
        "出愿材料清单",  # 完整的材料清单
        "推荐信要求详细",  # 需要几封、谁写等
        "出愿流程详细",  # 详细的出愿步骤
        # 合格情况详细字段
        "报录比（2024）",  # 2024年报录比
        "报录比（2023）",  # 2023年报录比
        "报录比（2022）",  # 2022年报录比
        "合格者成绩分布",  # 如果有公开的话
        # 数据来源字段
        "数据来源",  # 爬取/手动/合并
        "爬取时间",  # 爬取的时间戳
        "爬取URL",  # 爬取的网址
    ]
    
    # 审核字段
    review_columns = [
        "审核状态",  # 待审核/已审核/需修改/已确认
        "审核人",  # 审核的老师姓名
        "审核时间",  # 审核的时间
        "审核备注",  # 审核时的备注说明
        "数据质量评分",  # 1-5分，数据完整性和准确性评分
    ]
    
    # 合并所有字段
    all_columns = existing_columns + new_columns + review_columns
    
    # 创建新的DataFrame，包含所有字段
    df_review = pd.DataFrame(index=df.index, columns=all_columns)
    
    # 复制现有数据
    for col in existing_columns:
        df_review[col] = df[col]
    
    # 初始化新字段为空
    for col in new_columns + review_columns:
        df_review[col] = ""
    
    # 设置默认审核状态
    df_review["审核状态"] = "待审核"
    df_review["数据来源"] = "现有数据"
    
    print("📊 表格结构:")
    print(f"   - 总字段数: {len(all_columns)} 个")
    print(f"   - 现有字段: {len(existing_columns)} 个")
    print(f"   - 新增字段: {len(new_columns)} 个")
    print(f"   - 审核字段: {len(review_columns)} 个")
    print()
    
    # 保存为Excel（供飞书导入）
    print("💾 保存Excel文件...")
    with pd.ExcelWriter(OUTPUT_EXCEL, engine='openpyxl') as writer:
        df_review.to_excel(writer, sheet_name="审核表格", index=False)
    
    print(f"   ✅ Excel已保存: {OUTPUT_EXCEL}")
    
    # 同时保存为CSV（飞书也支持CSV导入）
    print("💾 保存CSV文件...")
    df_review.to_csv(OUTPUT_CSV, index=False, encoding='utf-8-sig')
    print(f"   ✅ CSV已保存: {OUTPUT_CSV}")
    print()
    
    # 生成字段说明文档
    print("📝 生成字段说明...")
    field_descriptions = {
        "现有字段": existing_columns,
        "新增字段": {
            "英语成绩类型": "TOEFL/TOEIC/IELTS等",
            "英语成绩推荐分数": "具体分数要求，如'80以上'",
            "JLPT等级": "N1/N2/N3等",
            "JLPT分数要求": "具体分数要求",
            "EJU推荐分数": "JSON格式，包含各科目推荐分数",
            "出愿材料清单": "完整的材料清单，用逗号分隔",
            "推荐信要求详细": "需要几封、谁写等详细信息",
            "出愿流程详细": "详细的出愿步骤",
            "报录比（2024）": "2024年的报录比",
            "报录比（2023）": "2023年的报录比",
            "报录比（2022）": "2022年的报录比",
            "合格者成绩分布": "如果有公开的话",
            "数据来源": "爬取/手动/合并",
            "爬取时间": "爬取的时间戳",
            "爬取URL": "爬取的网址",
        },
        "审核字段": {
            "审核状态": "待审核/已审核/需修改/已确认",
            "审核人": "审核的老师姓名",
            "审核时间": "审核的时间",
            "审核备注": "审核时的备注说明",
            "数据质量评分": "1-5分，数据完整性和准确性评分",
        }
    }
    
    print()
    print("=" * 60)
    print("✅ 完成！")
    print("=" * 60)
    print()
    print("📋 下一步操作:")
    print("   1. 打开飞书多维表格")
    print("   2. 点击'导入' → 选择'从Excel导入'或'从CSV导入'")
    print("   3. 选择文件:", OUTPUT_EXCEL.name, "或", OUTPUT_CSV.name)
    print("   4. 确认导入后，老师们就可以在飞书中审核数据了")
    print()
    print("💡 提示:")
    print("   - 审核状态列：老师们可以标记每条记录的审核状态")
    print("   - 审核备注列：可以记录需要修改的地方")
    print("   - 数据质量评分：可以给每条记录打分")
    print("   - 审核完成后，可以导出Excel，然后运行合并脚本更新主表格")
    
    return True

if __name__ == "__main__":
    create_review_table()
