#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
爬取各大学官网的期数和选考方式分类信息
目标：收集所有大学官网的实际表述，为建立标准分类体系提供数据基础
"""
import pandas as pd
import requests
from bs4 import BeautifulSoup
from pathlib import Path
import json
import time
import re
from datetime import datetime
from collections import defaultdict
from urllib.parse import urljoin, urlparse
from urllib.robotparser import RobotFileParser

# 文件路径
CSV_PATH = Path(__file__).parent.parent.parent / "学校总览.csv"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "crawled_data" / "classification_info"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 请求配置
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
}

# 延迟配置（避免对服务器造成压力）
REQUEST_DELAY = 2  # 秒

def check_robots_txt(url):
    """检查robots.txt"""
    try:
        parsed = urlparse(url)
        robots_url = f"{parsed.scheme}://{parsed.netloc}/robots.txt"
        rp = RobotFileParser()
        rp.set_url(robots_url)
        rp.read()
        return rp.can_fetch(HEADERS['User-Agent'], url)
    except:
        return True  # 如果无法读取robots.txt，默认允许

def extract_text_from_page(soup):
    """从页面提取文本内容"""
    # 移除script和style标签
    for script in soup(["script", "style"]):
        script.decompose()
    
    # 获取文本
    text = soup.get_text()
    # 清理文本
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    text = '\n'.join(chunk for chunk in chunks if chunk)
    return text

def find_admission_page_url(university_name, base_url=None):
    """
    尝试找到招生相关页面URL
    常见的招生页面路径：
    - /admission/
    - /nyushi/
    - /entrance/
    - /admissions/
    - /international/
    """
    if not base_url:
        # 如果没有提供base_url，尝试常见的大学域名格式
        # 这里需要根据实际情况调整
        return None
    
    common_paths = [
        "/admission/",
        "/nyushi/",
        "/entrance/",
        "/admissions/",
        "/international/",
        "/admission/undergraduate/",
        "/nyushi/gaikokujin/",
        "/entrance/international/",
    ]
    
    for path in common_paths:
        url = urljoin(base_url, path)
        try:
            response = requests.head(url, headers=HEADERS, timeout=5)
            if response.status_code == 200:
                return url
        except:
            continue
    
    return None

def extract_period_info(text, soup):
    """提取期数相关信息"""
    period_keywords = [
        "前期", "後期", "後期", "第1期", "第2期", "第3期", "第4期",
        "第一期", "第二期", "第三期", "第四期",
        "Ⅰ期", "Ⅱ期", "Ⅲ期", "Ⅳ期",
        "A方式", "B方式", "C方式",
        "前期選抜", "後期選抜", "単独選抜",
        "渡日前", "2月実施", "3月実施"
    ]
    
    found_periods = []
    text_lower = text.lower()
    
    # 查找包含期数关键词的句子
    for keyword in period_keywords:
        if keyword in text:
            # 尝试提取包含关键词的句子
            pattern = f'.{{0,50}}{re.escape(keyword)}.{{0,50}}'
            matches = re.findall(pattern, text)
            found_periods.extend(matches[:3])  # 最多保存3个匹配
    
    return list(set(found_periods))  # 去重

def extract_selection_method_info(text, soup):
    """提取选考方式相关信息"""
    method_keywords = [
        "外国人入試", "外国人特別選抜", "外国人選抜",
        "一般入試", "一般選抜",
        "推薦入試", "推薦選抜", "学校推薦",
        "AO入試", "AO選抜",
        "総合型選抜", "総合評価型",
        "EJU利用", "EJU利用型",
        "校内考", "書類選考", "面接"
    ]
    
    found_methods = []
    text_lower = text.lower()
    
    for keyword in method_keywords:
        if keyword in text:
            pattern = f'.{{0,50}}{re.escape(keyword)}.{{0,50}}'
            matches = re.findall(pattern, text)
            found_methods.extend(matches[:3])
    
    return list(set(found_methods))

def extract_exam_info(text, soup):
    """提取校内考相关信息"""
    exam_keywords = [
        "校内考", "校内試験", "面接", "小論文", "筆記試験",
        "一次選考", "二次選考", "第一次", "第二次",
        "書類選考のみ", "純書類"
    ]
    
    found_exams = []
    
    for keyword in exam_keywords:
        if keyword in text:
            pattern = f'.{{0,50}}{re.escape(keyword)}.{{0,50}}'
            matches = re.findall(pattern, text)
            found_exams.extend(matches[:3])
    
    return list(set(found_exams))

def extract_eju_subjects_info(text, soup):
    """提取EJU科目相关信息"""
    eju_keywords = [
        "EJU", "日本留学試験", "日本語", "数学", "数学コース1", "数学コース2",
        "総合科目", "物理", "化学", "生物", "理科"
    ]
    
    found_eju = []
    
    for keyword in eju_keywords:
        if keyword in text:
            pattern = f'.{{0,50}}{re.escape(keyword)}.{{0,50}}'
            matches = re.findall(pattern, text)
            found_eju.extend(matches[:3])
    
    return list(set(found_eju))

def crawl_university_info(university_name, department_name=None):
    """
    爬取单个大学的分类信息
    注意：这是一个基础框架，实际使用时需要根据各大学网站结构调整
    """
    result = {
        "university": university_name,
        "department": department_name or "",
        "period_info": [],
        "selection_method_info": [],
        "exam_info": [],
        "eju_subjects_info": [],
        "source_urls": [],
        "crawled_at": datetime.now().isoformat(),
        "status": "pending"
    }
    
    # 这里需要根据实际情况实现
    # 由于每个大学的网站结构不同，可能需要：
    # 1. 维护一个大学URL映射表
    # 2. 为每个大学编写特定的爬虫逻辑
    # 3. 或者使用通用的页面解析逻辑
    
    # 示例：尝试访问常见的招生页面
    # 实际实现需要更复杂的逻辑
    
    return result

def crawl_from_excel():
    """从Excel读取大学列表并爬取"""
    print("=" * 60)
    print("开始爬取各大学官网的分类信息")
    print("=" * 60)
    print()
    
    if not CSV_PATH.exists():
        print(f"❌ 找不到文件: {CSV_PATH}")
        return
    
    # 读取CSV
    print(f"📖 读取文件: {CSV_PATH}")
    df = pd.read_csv(CSV_PATH, encoding='utf-8-sig')
    print(f"   总记录数: {len(df)} 条")
    print()
    
    # 获取唯一的大学列表
    universities = df["大学"].unique()
    print(f"📊 发现 {len(universities)} 所不同的大学")
    print()
    
    # 统计每个大学的学部数
    dept_count = df.groupby("大学")["学部"].nunique()
    print("各大学的学部数（前10所）：")
    for uni, count in dept_count.head(10).items():
        print(f"  {uni}: {count} 个学部")
    print()
    
    # 收集所有不同的表述
    all_periods = defaultdict(list)
    all_methods = defaultdict(list)
    all_exams = defaultdict(list)
    all_eju = defaultdict(list)
    
    # 从现有数据中提取原始表述（作为参考）
    print("=" * 60)
    print("从现有数据中提取原始表述（作为参考）")
    print("=" * 60)
    print()
    
    for _, row in df.iterrows():
        uni = row["大学"]
        dept = row["学部"]
        period = str(row.get("第几期", "")).strip()
        method = str(row.get("方式", "")).strip()
        exam = str(row.get("校内考形式", "")).strip()
        eju = str(row.get("需要EJU科目", "")).strip()
        
        if period:
            all_periods[period].append({"university": uni, "department": dept})
        if method:
            all_methods[method].append({"university": uni, "department": dept})
        if exam:
            all_exams[exam].append({"university": uni, "department": dept})
        if eju:
            all_eju[eju].append({"university": uni, "department": dept})
    
    # 保存现有数据的统计
    print("期数表述统计（现有数据）：")
    for period, records in sorted(all_periods.items(), key=lambda x: len(x[1]), reverse=True)[:10]:
        print(f"  {period:30s} : {len(records):5d} 次")
    print()
    
    print("选考方式表述统计（现有数据）：")
    for method, records in sorted(all_methods.items(), key=lambda x: len(x[1]), reverse=True)[:10]:
        print(f"  {method:30s} : {len(records):5d} 次")
    print()
    
    # 保存到JSON
    existing_data = {
        "periods": {k: len(v) for k, v in all_periods.items()},
        "methods": {k: len(v) for k, v in all_methods.items()},
        "exams": {k: len(v) for k, v in all_exams.items()},
        "eju_subjects": {k: len(v) for k, v in all_eju.items()},
    }
    
    existing_data_path = OUTPUT_DIR / "existing_data_statistics.json"
    with open(existing_data_path, "w", encoding="utf-8") as f:
        json.dump(existing_data, f, ensure_ascii=False, indent=2)
    print(f"✅ 现有数据统计已保存到: {existing_data_path}")
    print()
    
    print("=" * 60)
    print("下一步：爬取各大学官网")
    print("=" * 60)
    print()
    print("⚠️  注意：")
    print("1. 由于每个大学的网站结构不同，需要为每个大学编写特定的爬虫逻辑")
    print("2. 或者维护一个大学URL映射表，手动指定每个大学的招生页面URL")
    print("3. 建议先做试点，选择10-20所代表性大学测试")
    print()
    print("建议的实施方案：")
    print("1. 先创建一个大学URL映射表（手动填写各大学的招生页面URL）")
    print("2. 编写通用的页面解析逻辑")
    print("3. 为特殊网站编写特定的爬虫逻辑")
    print("4. 逐步扩展到所有大学")


if __name__ == "__main__":
    crawl_from_excel()
