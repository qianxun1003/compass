#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简化版爬虫：从现有数据中提取信息，并尝试访问官网补充
目标：收集所有不同的期数和选考方式表述
"""
import pandas as pd
from pathlib import Path
import json
from datetime import datetime
from collections import defaultdict

# 可选依赖（用于后续爬取）
try:
    import requests
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False

# 文件路径
CSV_PATH = Path(__file__).parent.parent.parent / "学校总览.csv"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "crawled_data" / "classification_info"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

def extract_all_classifications_from_excel():
    """
    从现有Excel数据中提取所有不同的表述
    这是第一步：先了解现有数据中有哪些表述
    """
    print("=" * 60)
    print("第一步：从现有数据中提取所有表述")
    print("=" * 60)
    print()
    
    if not CSV_PATH.exists():
        print(f"❌ 找不到文件: {CSV_PATH}")
        return
    
    df = pd.read_csv(CSV_PATH, encoding='utf-8-sig')
    print(f"📖 读取文件: {CSV_PATH}")
    print(f"   总记录数: {len(df)} 条")
    print()
    
    # 收集所有不同的表述
    periods = defaultdict(list)
    methods = defaultdict(list)
    exams = defaultdict(list)
    eju_subjects = defaultdict(list)
    
    for _, row in df.iterrows():
        uni = str(row.get("大学", "")).strip()
        dept = str(row.get("学部", "")).strip()
        
        # 期数
        period = str(row.get("第几期", "")).strip()
        if period and period != "nan":
            periods[period].append({
                "university": uni,
                "department": dept,
                "source": "existing_data"
            })
        
        # 选考方式
        method = str(row.get("方式", "")).strip()
        if method and method != "nan":
            methods[method].append({
                "university": uni,
                "department": dept,
                "source": "existing_data"
            })
        
        # 校内考
        exam = str(row.get("校内考形式", "")).strip()
        if exam and exam != "nan":
            exams[exam].append({
                "university": uni,
                "department": dept,
                "source": "existing_data"
            })
        
        # EJU科目
        eju = str(row.get("需要EJU科目", "")).strip()
        if eju and eju != "nan":
            eju_subjects[eju].append({
                "university": uni,
                "department": dept,
                "source": "existing_data"
            })
    
    # 保存结果
    result = {
        "extracted_at": datetime.now().isoformat(),
        "source": "学校总览.csv",
        "total_records": len(df),
        "periods": {
            "unique_count": len(periods),
            "distribution": {k: len(v) for k, v in sorted(periods.items(), key=lambda x: len(x[1]), reverse=True)},
            "details": {k: v[:5] for k, v in periods.items()}  # 每种表述的前5个示例
        },
        "methods": {
            "unique_count": len(methods),
            "distribution": {k: len(v) for k, v in sorted(methods.items(), key=lambda x: len(x[1]), reverse=True)},
            "details": {k: v[:5] for k, v in methods.items()}
        },
        "exams": {
            "unique_count": len(exams),
            "distribution": {k: len(v) for k, v in sorted(exams.items(), key=lambda x: len(x[1]), reverse=True)},
            "details": {k: v[:5] for k, v in exams.items()}
        },
        "eju_subjects": {
            "unique_count": len(eju_subjects),
            "distribution": {k: len(v) for k, v in sorted(eju_subjects.items(), key=lambda x: len(x[1]), reverse=True)},
            "details": {k: v[:5] for k, v in eju_subjects.items()}
        }
    }
    
    # 保存到JSON
    output_path = OUTPUT_DIR / "existing_classifications.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print("✅ 提取完成！")
    print()
    print(f"📊 统计结果：")
    print(f"   期数表述：{len(periods)} 种")
    print(f"   选考方式表述：{len(methods)} 种")
    print(f"   校内考表述：{len(exams)} 种")
    print(f"   EJU科目表述：{len(eju_subjects)} 种")
    print()
    print(f"✅ 详细数据已保存到: {output_path}")
    print()
    
    # 显示前10种最常见的表述
    print("=" * 60)
    print("期数表述（前10种）：")
    print("=" * 60)
    for period, records in sorted(periods.items(), key=lambda x: len(x[1]), reverse=True)[:10]:
        print(f"  {period:30s} : {len(records):5d} 次")
        print(f"    示例: {records[0]['university']} - {records[0]['department']}")
    print()
    
    print("=" * 60)
    print("选考方式表述（前10种）：")
    print("=" * 60)
    for method, records in sorted(methods.items(), key=lambda x: len(x[1]), reverse=True)[:10]:
        print(f"  {method:30s} : {len(records):5d} 次")
        print(f"    示例: {records[0]['university']} - {records[0]['department']}")
    print()
    
    return result

def generate_crawl_plan():
    """
    生成爬取计划
    基于现有数据，识别需要重点关注的大学
    """
    print("=" * 60)
    print("生成爬取计划")
    print("=" * 60)
    print()
    
    df = pd.read_csv(CSV_PATH, encoding='utf-8-sig')
    
    # 统计每个大学的记录数
    uni_counts = df.groupby("大学").size().sort_values(ascending=False)
    
    print("建议的爬取优先级（按记录数排序，前20所）：")
    print()
    for i, (uni, count) in enumerate(uni_counts.head(20).items(), 1):
        print(f"{i:2d}. {uni:30s} : {count:4d} 条记录")
    
    print()
    print("=" * 60)
    print("下一步行动建议")
    print("=" * 60)
    print()
    print("1. ✅ 已完成：从现有数据提取所有表述")
    print("2. ⏳ 下一步：创建大学URL映射表")
    print("   - 文件：crawled_data/university_urls.json")
    print("   - 模板：crawled_data/university_urls_template.json")
    print("   - 建议：先填写前20所大学的URL")
    print()
    print("3. ⏳ 然后：编写爬虫脚本访问官网")
    print("   - 提取官网上的实际表述")
    print("   - 与现有数据对比")
    print("   - 发现新的表述")
    print()
    print("4. ⏳ 最后：基于爬取结果建立标准分类")
    print("   - 统计所有不同的表述")
    print("   - 识别同义词和变体")
    print("   - 建立标准分类体系")


if __name__ == "__main__":
    # 第一步：从现有数据提取
    result = extract_all_classifications_from_excel()
    
    # 生成爬取计划
    generate_crawl_plan()
    
    print()
    print("=" * 60)
    print("完成！")
    print("=" * 60)
    print()
    print("📝 下一步：")
    print("1. 查看 crawled_data/classification_info/existing_classifications.json")
    print("2. 填写大学URL映射表（crawled_data/university_urls_template.json）")
    print("3. 运行爬虫脚本访问官网（待实现）")
