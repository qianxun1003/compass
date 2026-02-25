#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
统一爬取框架：一次性爬取所有需要的数据
包括：基础信息、期数、选考方式、校内考、出愿时间、出愿材料、成绩要求、合格情况等
"""
import json
import re
from pathlib import Path
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Optional, Any

# 可选依赖
try:
    import requests
    from bs4 import BeautifulSoup
    import pdfplumber
    CRAWLER_AVAILABLE = True
except ImportError:
    CRAWLER_AVAILABLE = False
    print("⚠️  警告：缺少爬虫依赖库。请安装：pip install requests beautifulsoup4 pdfplumber")

# 文件路径
CSV_PATH = Path(__file__).parent.parent.parent / "学校总览.csv"
URL_MAPPING_PATH = Path(__file__).parent.parent.parent / "crawled_data" / "university_urls.json"
OUTPUT_DIR = Path(__file__).parent.parent.parent / "crawled_data" / "unified_crawl_results"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
}

REQUEST_DELAY = 2  # 秒


class UnifiedCrawler:
    """统一爬取框架"""
    
    def __init__(self):
        self.results = []
        self.statistics = {
            "total_processed": 0,
            "successful": 0,
            "failed": 0,
            "extraction_stats": defaultdict(int)
        }
    
    def extract_basic_info(self, text: str, soup: Any) -> Dict[str, Any]:
        """提取基础信息"""
        result = {
            "学部": None,
            "学科": None,
            "地理位置": None,
            "文理": None,
            "status": "not_found"
        }
        
        # 这里需要根据实际页面结构编写提取逻辑
        # 示例：查找包含"学部"的文本
        # 实际实现需要更复杂的逻辑
        
        return result
    
    def extract_period_info(self, text: str, soup: Any) -> Dict[str, Any]:
        """提取期数信息"""
        result = {
            "原始表述": None,
            "所有可能的表述": [],
            "status": "not_found"
        }
        
        # 期数关键词
        period_keywords = [
            "前期", "後期", "後期", "第1期", "第2期", "第3期", "第4期",
            "第一期", "第二期", "第三期", "第四期",
            "Ⅰ期", "Ⅱ期", "Ⅲ期", "Ⅳ期",
            "A方式", "B方式", "C方式",
            "前期選抜", "後期選抜", "単独選抜",
            "渡日前", "2月実施", "3月実施", "只有一期"
        ]
        
        found_periods = []
        for keyword in period_keywords:
            if keyword in text:
                # 提取包含关键词的句子
                pattern = f'.{{0,50}}{re.escape(keyword)}.{{0,50}}'
                matches = re.findall(pattern, text)
                found_periods.extend(matches[:3])
        
        if found_periods:
            result["原始表述"] = found_periods[0]
            result["所有可能的表述"] = list(set(found_periods))
            result["status"] = "found"
        
        return result
    
    def extract_selection_method_info(self, text: str, soup: Any) -> Dict[str, Any]:
        """提取选考方式信息"""
        result = {
            "原始表述": None,
            "所有可能的表述": [],
            "status": "not_found"
        }
        
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
        for keyword in method_keywords:
            if keyword in text:
                pattern = f'.{{0,50}}{re.escape(keyword)}.{{0,50}}'
                matches = re.findall(pattern, text)
                found_methods.extend(matches[:3])
        
        if found_methods:
            result["原始表述"] = found_methods[0]
            result["所有可能的表述"] = list(set(found_methods))
            result["status"] = "found"
        
        return result
    
    def extract_exam_info(self, text: str, soup: Any) -> Dict[str, Any]:
        """提取校内考信息"""
        result = {
            "有无": None,
            "一次选考": {
                "名称": None,
                "时间": None,
                "形式": None,
                "status": "not_found"
            },
            "二次选考": {
                "名称": None,
                "时间": None,
                "形式": None,
                "status": "not_found"
            },
            "status": "not_found"
        }
        
        # 查找校内考相关信息
        exam_keywords = ["校内考", "校内試験", "面接", "小論文", "筆記試験"]
        has_exam = any(keyword in text for keyword in exam_keywords)
        
        if has_exam:
            result["有无"] = "有"
            result["status"] = "found"
            
            # 查找一次/二次选考
            # 这里需要更复杂的逻辑来提取具体信息
        
        return result
    
    def extract_application_time_info(self, text: str, soup: Any) -> Dict[str, Any]:
        """提取出愿时间信息"""
        result = {
            "网上出愿开始": None,
            "网上出愿截止": None,
            "邮寄开始": None,
            "邮寄截止": None,
            "必着/消印": None,
            "status": "not_found"
        }
        
        # 查找日期信息
        date_pattern = r'(\d{4})[年/](\d{1,2})[月/](\d{1,2})[日]?'
        dates = re.findall(date_pattern, text)
        
        # 这里需要更复杂的逻辑来识别哪个日期对应哪个字段
        
        return result
    
    def extract_application_materials_info(self, text: str, soup: Any) -> Dict[str, Any]:
        """提取出愿材料信息"""
        result = {
            "材料清单": [],
            "推荐信要求": None,
            "出愿流程": None,
            "status": "not_found"
        }
        
        # 查找材料相关关键词
        material_keywords = ["入学志愿书", "成绩证明书", "毕业证明书", "推荐信", "研究计划书"]
        found_materials = []
        
        for keyword in material_keywords:
            if keyword in text:
                found_materials.append(keyword)
        
        if found_materials:
            result["材料清单"] = found_materials
            result["status"] = "found"
        
        # 查找推荐信要求
        if "推荐信" in text or "推薦" in text:
            # 提取推荐信相关句子
            pattern = r'.{0,100}(推荐信|推薦).{0,100}'
            matches = re.findall(pattern, text)
            if matches:
                result["推荐信要求"] = matches[0]
        
        return result
    
    def extract_score_requirements_info(self, text: str, soup: Any) -> Dict[str, Any]:
        """提取成绩要求信息"""
        result = {
            "EJU科目": {
                "需要的科目": [],
                "推荐分数": {},
                "status": "not_found"
            },
            "英语": {
                "是否需要": None,
                "成绩类型": None,
                "推荐分数": None,
                "status": "not_found"
            },
            "JLPT": {
                "是否需要": None,
                "等级要求": None,
                "分数要求": None,
                "status": "not_found"
            }
        }
        
        # 查找EJU科目
        eju_keywords = ["日语", "日本語", "数学", "数学コース1", "数学コース2", "総合科目", "物理", "化学", "生物"]
        found_eju = []
        for keyword in eju_keywords:
            if keyword in text:
                found_eju.append(keyword)
        
        if found_eju:
            result["EJU科目"]["需要的科目"] = list(set(found_eju))
            result["EJU科目"]["status"] = "found"
        
        # 查找英语要求
        if "TOEFL" in text or "托福" in text:
            result["英语"]["是否需要"] = "要"
            result["英语"]["成绩类型"] = "TOEFL"
            result["英语"]["status"] = "found"
        elif "TOEIC" in text:
            result["英语"]["是否需要"] = "要"
            result["英语"]["成绩类型"] = "TOEIC"
            result["英语"]["status"] = "found"
        elif "IELTS" in text:
            result["英语"]["是否需要"] = "要"
            result["英语"]["成绩类型"] = "IELTS"
            result["英语"]["status"] = "found"
        
        # 查找JLPT要求
        if "JLPT" in text or "N1" in text or "N2" in text:
            result["JLPT"]["是否需要"] = "要"
            # 提取等级
            if "N1" in text:
                result["JLPT"]["等级要求"] = "N1"
            elif "N2" in text:
                result["JLPT"]["等级要求"] = "N2"
            result["JLPT"]["status"] = "found"
        
        return result
    
    def extract_admission_stats_info(self, text: str, soup: Any) -> Dict[str, Any]:
        """提取合格情况信息"""
        result = {
            "报录比": {},
            "合格人成绩": None,
            "status": "not_found"
        }
        
        # 查找报录比相关信息
        # 这里需要更复杂的逻辑
        
        return result
    
    def crawl_university(self, university_name: str, department_name: str, url: str) -> Dict[str, Any]:
        """爬取单个大学/学部的所有信息"""
        result = {
            "university": university_name,
            "department": department_name,
            "crawled_at": datetime.now().isoformat(),
            "source_url": url,
            "基础信息": {},
            "期数信息": {},
            "选考方式": {},
            "校内考信息": {},
            "出愿时间": {},
            "出愿材料": {},
            "成绩要求": {},
            "合格情况": {},
            "提取质量": {
                "完整度": 0.0,
                "需要人工审核": False,
                "提取问题": []
            },
            "status": "pending"
        }
        
        if not CRAWLER_AVAILABLE:
            result["status"] = "error"
            result["提取质量"]["提取问题"].append("缺少爬虫依赖库")
            return result
        
        try:
            # 访问页面
            response = requests.get(url, headers=HEADERS, timeout=10)
            response.encoding = 'utf-8'
            
            if response.status_code != 200:
                result["status"] = "error"
                result["提取质量"]["提取问题"].append(f"HTTP错误: {response.status_code}")
                return result
            
            # 解析HTML
            soup = BeautifulSoup(response.content, 'html.parser')
            text = extract_text_from_page(soup)
            
            # 提取所有信息
            result["基础信息"] = self.extract_basic_info(text, soup)
            result["期数信息"] = self.extract_period_info(text, soup)
            result["选考方式"] = self.extract_selection_method_info(text, soup)
            result["校内考信息"] = self.extract_exam_info(text, soup)
            result["出愿时间"] = self.extract_application_time_info(text, soup)
            result["出愿材料"] = self.extract_application_materials_info(text, soup)
            result["成绩要求"] = self.extract_score_requirements_info(text, soup)
            result["合格情况"] = self.extract_admission_stats_info(text, soup)
            
            # 计算完整度
            total_fields = 8  # 8个主要信息类别
            found_fields = sum(1 for key in ["基础信息", "期数信息", "选考方式", "校内考信息", 
                                            "出愿时间", "出愿材料", "成绩要求", "合格情况"]
                             if result[key].get("status") == "found")
            result["提取质量"]["完整度"] = found_fields / total_fields
            
            result["status"] = "success"
            self.statistics["successful"] += 1
            
        except Exception as e:
            result["status"] = "error"
            result["提取质量"]["提取问题"].append(str(e))
            self.statistics["failed"] += 1
        
        return result
    
    def crawl_from_excel(self):
        """从Excel读取数据并爬取"""
        print("=" * 60)
        print("统一爬取框架")
        print("=" * 60)
        print()
        
        if not CSV_PATH.exists():
            print(f"❌ 找不到文件: {CSV_PATH}")
            return
        
        # 读取URL映射表
        if not URL_MAPPING_PATH.exists():
            print(f"⚠️  找不到URL映射表: {URL_MAPPING_PATH}")
            print("   请先创建URL映射表（参考 university_urls_template.json）")
            return
        
        with open(URL_MAPPING_PATH, "r", encoding="utf-8") as f:
            url_mapping = json.load(f)
        
        # 读取Excel
        df = pd.read_csv(CSV_PATH, encoding='utf-8-sig')
        
        print(f"📖 读取数据:")
        print(f"   Excel记录数: {len(df)} 条")
        print(f"   URL映射数: {len(url_mapping)} 所大学")
        print()
        
        # 爬取每个大学/学部
        for _, row in df.iterrows():
            uni = row["大学"]
            dept = row["学部"]
            
            # 获取URL
            url = None
            if uni in url_mapping:
                if isinstance(url_mapping[uni], str):
                    url = url_mapping[uni]
                elif isinstance(url_mapping[uni], dict):
                    url = url_mapping[uni].get("main_admission_url") or url_mapping[uni].get("main")
            
            if not url:
                print(f"⚠️  跳过 {uni} - {dept}: 没有URL")
                continue
            
            print(f"🕷️  爬取: {uni} - {dept}")
            result = self.crawl_university(uni, dept, url)
            self.results.append(result)
            self.statistics["total_processed"] += 1
            
            # 延迟
            time.sleep(REQUEST_DELAY)
        
        # 保存结果
        self.save_results()
    
    def save_results(self):
        """保存爬取结果"""
        # 保存所有结果
        results_path = OUTPUT_DIR / f"crawl_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        with open(results_path, "w", encoding="utf-8") as f:
            json.dump(self.results, f, ensure_ascii=False, indent=2)
        
        # 生成统计报告
        self.generate_statistics_report()
        
        print()
        print("=" * 60)
        print("爬取完成！")
        print("=" * 60)
        print(f"✅ 结果已保存到: {results_path}")
        print(f"📊 统计报告已生成")
    
    def generate_statistics_report(self):
        """生成统计报告"""
        # 统计各种表述
        period_statistics = defaultdict(int)
        method_statistics = defaultdict(int)
        
        for result in self.results:
            if result["期数信息"].get("原始表述"):
                period_statistics[result["期数信息"]["原始表述"]] += 1
            if result["选考方式"].get("原始表述"):
                method_statistics[result["选考方式"]["原始表述"]] += 1
        
        stats = {
            "爬取统计": {
                "总处理数": self.statistics["total_processed"],
                "成功": self.statistics["successful"],
                "失败": self.statistics["failed"]
            },
            "期数表述统计": dict(sorted(period_statistics.items(), key=lambda x: x[1], reverse=True)),
            "选考方式表述统计": dict(sorted(method_statistics.items(), key=lambda x: x[1], reverse=True))
        }
        
        stats_path = OUTPUT_DIR / "statistics_report.json"
        with open(stats_path, "w", encoding="utf-8") as f:
            json.dump(stats, f, ensure_ascii=False, indent=2)
        
        print(f"✅ 统计报告已保存到: {stats_path}")


def extract_text_from_page(soup):
    """从页面提取文本"""
    for script in soup(["script", "style"]):
        script.decompose()
    text = soup.get_text()
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    return '\n'.join(chunk for chunk in chunks if chunk)


if __name__ == "__main__":
    if not CRAWLER_AVAILABLE:
        print("=" * 60)
        print("⚠️  缺少爬虫依赖库")
        print("=" * 60)
        print()
        print("请安装依赖：")
        print("  pip install requests beautifulsoup4 pdfplumber")
        print()
        print("或者先运行数据提取脚本（不需要爬虫库）：")
        print("  python3 scripts/crawlers/simple_crawl_classification.py")
    else:
        crawler = UnifiedCrawler()
        crawler.crawl_from_excel()
