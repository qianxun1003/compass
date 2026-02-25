#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
分析现有数据中的选考方式分类情况
统计所有不同的选考方式表述，为建立标准分类体系做准备
"""
import pandas as pd
from pathlib import Path
from collections import Counter
import json

# 文件路径
CSV_PATH = Path(__file__).parent.parent / "学校总览.csv"
OUTPUT_DIR = Path(__file__).parent.parent / "standardization"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def analyze_selection_method_classification():
    """分析选考方式分类"""
    print("=" * 60)
    print("选考方式分类分析")
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
    if "方式" not in df.columns:
        print("❌ 找不到'方式'列")
        return
    
    # 统计选考方式分类
    method_col = df["方式"]
    
    # 去除空值
    non_null_methods = method_col.dropna()
    print(f"📊 非空记录数: {len(non_null_methods)} 条")
    print(f"   空值记录数: {len(method_col) - len(non_null_methods)} 条")
    print()
    
    # 统计所有不同的表述
    method_counter = Counter()
    for method in non_null_methods:
        method_str = str(method).strip()
        if method_str:
            method_counter[method_str] += 1
    
    # 按出现次数排序
    sorted_methods = method_counter.most_common()
    
    print("=" * 60)
    print("选考方式分类统计")
    print("=" * 60)
    print()
    print(f"共发现 {len(sorted_methods)} 种不同的选考方式表述：")
    print()
    
    # 显示统计结果
    for method, count in sorted_methods:
        percentage = (count / len(non_null_methods)) * 100
        print(f"  {method:30s} : {count:5d} 次 ({percentage:5.2f}%)")
    
    print()
    print("=" * 60)
    print("数据详情")
    print("=" * 60)
    print()
    
    # 保存详细统计到JSON
    stats = {
        "total_records": len(df),
        "non_null_records": len(non_null_methods),
        "null_records": len(method_col) - len(non_null_methods),
        "unique_methods": len(sorted_methods),
        "method_distribution": [
            {
                "method": method,
                "count": count,
                "percentage": round((count / len(non_null_methods)) * 100, 2)
            }
            for method, count in sorted_methods
        ]
    }
    
    # 保存JSON
    json_path = OUTPUT_DIR / "selection_method_analysis.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=2)
    print(f"✅ 详细统计已保存到: {json_path}")
    
    # 生成示例数据（每种选考方式类型的前3条记录）
    print()
    print("=" * 60)
    print("示例数据（每种选考方式类型的前3条记录）")
    print("=" * 60)
    print()
    
    examples = {}
    for method, _ in sorted_methods[:10]:  # 只显示前10种
        matching_rows = df[df["方式"] == method].head(3)
        if len(matching_rows) > 0:
            examples[method] = []
            for _, row in matching_rows.iterrows():
                examples[method].append({
                    "大学": row.get("大学", ""),
                    "学部": row.get("学部", ""),
                    "方式": row.get("方式", ""),
                    "第几期": row.get("第几期", "")
                })
    
    examples_path = OUTPUT_DIR / "selection_method_examples.json"
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
        "外国人入試": [],
        "一般入試": [],
        "推薦入試": [],
        "AO入試": [],
        "総合型選抜": [],
        "学校推薦型選抜": [],
        "其他": []
    }
    
    for method, count in sorted_methods:
        method_str = str(method)
        if "外国人" in method_str or "外国" in method_str:
            suggested_categories["外国人入試"].append({"method": method, "count": count})
        elif "一般" in method_str:
            suggested_categories["一般入試"].append({"method": method, "count": count})
        elif "推薦" in method_str or "推荐" in method_str:
            if "学校" in method_str:
                suggested_categories["学校推薦型選抜"].append({"method": method, "count": count})
            else:
                suggested_categories["推薦入試"].append({"method": method, "count": count})
        elif "AO" in method_str or "ao" in method_str.lower():
            suggested_categories["AO入試"].append({"method": method, "count": count})
        elif "総合型" in method_str or "综合型" in method_str:
            suggested_categories["総合型選抜"].append({"method": method, "count": count})
        else:
            suggested_categories["其他"].append({"method": method, "count": count})
    
    for category, methods in suggested_categories.items():
        if methods:
            total_count = sum(m["count"] for m in methods)
            print(f"{category}:")
            for m in methods:
                print(f"  - {m['method']:30s} ({m['count']} 次)")
            print(f"  小计: {total_count} 次")
            print()
    
    # 保存建议分类
    suggested_path = OUTPUT_DIR / "selection_method_suggested_categories.json"
    with open(suggested_path, "w", encoding="utf-8") as f:
        json.dump(suggested_categories, f, ensure_ascii=False, indent=2)
    print(f"✅ 建议分类已保存到: {suggested_path}")
    
    print()
    print("=" * 60)
    print("分析完成！")
    print("=" * 60)
    print()
    print("下一步：")
    print("1. 查看 standardization/selection_method_analysis.json 了解详细统计")
    print("2. 查看 standardization/selection_method_examples.json 查看示例数据")
    print("3. 查看 standardization/selection_method_suggested_categories.json 查看建议分类")
    print("4. 基于这些信息，建立最终的标准分类体系")


if __name__ == "__main__":
    analyze_selection_method_classification()
