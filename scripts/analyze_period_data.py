#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
分析现有数据中的期数分类情况
统计所有不同的期数表述，为建立标准分类体系做准备
"""
import pandas as pd
from pathlib import Path
from collections import Counter
import json

# 文件路径
CSV_PATH = Path(__file__).parent.parent / "学校总览.csv"
OUTPUT_DIR = Path(__file__).parent.parent / "standardization"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def analyze_period_classification():
    """分析期数分类"""
    print("=" * 60)
    print("期数分类分析")
    print("=" * 60)
    print()
    
    # 读取CSV
    if not CSV_PATH.exists():
        print(f"❌ 找不到文件: {CSV_PATH}")
        return
    
    print(f"📖 读取文件: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH, encoding='utf-8-sig')
    print(f"   总记录数: {len(df)} 条")
    print()
    
    # 检查列是否存在
    if "第几期" not in df.columns:
        print("❌ 找不到'第几期'列")
        return
    
    # 统计期数分类
    period_col = df["第几期"]
    
    # 去除空值
    non_null_periods = period_col.dropna()
    print(f"📊 非空记录数: {len(non_null_periods)} 条")
    print(f"   空值记录数: {len(period_col) - len(non_null_periods)} 条")
    print()
    
    # 统计所有不同的表述
    period_counter = Counter()
    for period in non_null_periods:
        period_str = str(period).strip()
        if period_str:
            period_counter[period_str] += 1
    
    # 按出现次数排序
    sorted_periods = period_counter.most_common()
    
    print("=" * 60)
    print("期数分类统计")
    print("=" * 60)
    print()
    print(f"共发现 {len(sorted_periods)} 种不同的期数表述：")
    print()
    
    # 显示统计结果
    for period, count in sorted_periods:
        percentage = (count / len(non_null_periods)) * 100
        print(f"  {period:30s} : {count:5d} 次 ({percentage:5.2f}%)")
    
    print()
    print("=" * 60)
    print("数据详情")
    print("=" * 60)
    print()
    
    # 保存详细统计到JSON
    stats = {
        "total_records": len(df),
        "non_null_records": len(non_null_periods),
        "null_records": len(period_col) - len(non_null_periods),
        "unique_periods": len(sorted_periods),
        "period_distribution": [
            {
                "period": period,
                "count": count,
                "percentage": round((count / len(non_null_periods)) * 100, 2)
            }
            for period, count in sorted_periods
        ]
    }
    
    # 保存JSON
    json_path = OUTPUT_DIR / "period_analysis.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print(f"✅ 详细统计已保存到: {json_path}")
    
    # 生成示例数据（每种期数类型的前3条记录）
    print()
    print("=" * 60)
    print("示例数据（每种期数类型的前3条记录）")
    print("=" * 60)
    print()
    
    examples = {}
    for period, _ in sorted_periods[:10]:  # 只显示前10种
        matching_rows = df[df["第几期"] == period].head(3)
        if len(matching_rows) > 0:
            examples[period] = []
            for _, row in matching_rows.iterrows():
                examples[period].append({
                    "大学": row.get("大学", ""),
                    "学部": row.get("学部", ""),
                    "第几期": row.get("第几期", ""),
                    "方式": row.get("方式", "")
                })
    
    examples_path = OUTPUT_DIR / "period_examples.json"
    with open(examples_path, "w", encoding="utf-8") as f:
        json.dump(examples, f, ensure_ascii=False, indent=2)
    print(f"✅ 示例数据已保存到: {examples_path}")
    
    # 生成建议的标准分类
    print()
    print("=" * 60)
    print("建议的标准分类（初步）")
    print("=" * 60)
    print()
    print("基于分析结果，建议的标准分类：")
    print()
    
    # 简单的分类建议（基于关键词）
    suggested_categories = {
        "只有一期": [],
        "前期": [],
        "后期": [],
        "前期+后期": [],
        "其他": []
    }
    
    for period, count in sorted_periods:
        period_lower = str(period).lower()
        if "只有一期" in period or "単独" in period or "一期のみ" in period:
            suggested_categories["只有一期"].append({"period": period, "count": count})
        elif "前期" in period and "后期" in period:
            suggested_categories["前期+后期"].append({"period": period, "count": count})
        elif "前期" in period:
            suggested_categories["前期"].append({"period": period, "count": count})
        elif "后期" in period or "後期" in period:
            suggested_categories["后期"].append({"period": period, "count": count})
        else:
            suggested_categories["其他"].append({"period": period, "count": count})
    
    for category, periods in suggested_categories.items():
        if periods:
            total_count = sum(p["count"] for p in periods)
            print(f"{category}:")
            for p in periods:
                print(f"  - {p['period']:30s} ({p['count']} 次)")
            print(f"  小计: {total_count} 次")
            print()
    
    # 保存建议分类
    suggested_path = OUTPUT_DIR / "period_suggested_categories.json"
    with open(suggested_path, "w", encoding="utf-8") as f:
        json.dump(suggested_categories, f, ensure_ascii=False, indent=2)
    print(f"✅ 建议分类已保存到: {suggested_path}")
    
    print()
    print("=" * 60)
    print("分析完成！")
    print("=" * 60)
    print()
    print("下一步：")
    print("1. 查看 standardization/period_analysis.json 了解详细统计")
    print("2. 查看 standardization/period_examples.json 查看示例数据")
    print("3. 查看 standardization/period_suggested_categories.json 查看建议分类")
    print("4. 基于这些信息，建立最终的标准分类体系")


if __name__ == "__main__":
    analyze_period_classification()
