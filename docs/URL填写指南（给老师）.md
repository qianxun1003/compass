# URL填写指南（给机构老师）

## 📋 一、什么是"主URL"？

**主URL就是：各大学官网的"外国人入試"或"留学生入試"页面的网址**

这个页面通常包含：
- 招生信息
- 出愿要求
- 考试信息
- 成绩要求
- 等等所有我们需要的信息

---

## 🔍 二、如何找到URL？（以東京大学为例）

### 步骤1：打开大学官网

访问：`https://www.u-tokyo.ac.jp`

### 步骤2：找到"入試"或"Admissions"菜单

**方法A：在顶部导航栏查找**
- 通常会有"入試"、"Admissions"、"受験生の方へ"等菜单
- 点击进入

**方法B：在网站地图中查找**
- 有些网站有"サイトマップ"（网站地图）
- 在其中查找"入試"相关链接

**方法C：直接搜索**
- 在网站搜索框中搜索"外国人入試"或"International Students"

### 步骤3：找到"外国人入試"或"留学生入試"页面

**常见页面名称**：
- "外国人入試"
- "留学生入試"
- "International Students"
- "外国人特別選抜"
- "私費外国人留学生入試"

### 步骤4：复制页面URL

**具体操作**：
1. 找到正确的页面后
2. 查看浏览器地址栏（顶部）
3. 复制完整的网址

**示例**：
```
https://www.u-tokyo.ac.jp/admission/undergraduate/foreign.html
```

这就是"主URL"！

---

## 📝 三、在哪里填写URL？

### 方式1：Excel表格（推荐，最简单）

**我为您创建了Excel模板**：`crawled_data/大学URL填写表.xlsx`

**格式**：
| 大学名 | 主URL |
|--------|-------|
| 東京大学 | https://www.u-tokyo.ac.jp/admission/undergraduate/foreign.html |
| 京都大学 | https://www.kyoto-u.ac.jp/ja/admissions/undergraduate/international |
| ... | ... |

**填写步骤**：
1. 打开Excel文件
2. 在第一列填写大学名
3. 在第二列填写找到的URL
4. 保存文件

**就这么简单！**

### 方式2：JSON文件（如果您熟悉）

**文件**：`crawled_data/university_urls.json`

**格式**：
```json
{
  "東京大学": "https://www.u-tokyo.ac.jp/admission/undergraduate/foreign.html",
  "京都大学": "https://www.kyoto-u.ac.jp/ja/admissions/undergraduate/international"
}
```

---

## 🎯 四、具体示例

### 示例1：東京大学

**步骤**：
1. 访问：`https://www.u-tokyo.ac.jp`
2. 点击顶部菜单："入試・進学" → "学部入試"
3. 找到："外国人入試"
4. 点击进入
5. 复制地址栏URL：`https://www.u-tokyo.ac.jp/admission/undergraduate/foreign.html`

**这就是主URL！**

### 示例2：京都大学

**步骤**：
1. 访问：`https://www.kyoto-u.ac.jp`
2. 点击："入試・学生生活" → "入試情報"
3. 找到："外国人留学生入試"
4. 点击进入
5. 复制地址栏URL：`https://www.kyoto-u.ac.jp/ja/admissions/undergraduate/international`

**这就是主URL！**

### 示例3：早稲田大学

**步骤**：
1. 访问：`https://www.waseda.jp`
2. 点击："入試情報"
3. 找到："外国人留学生入試"
4. 点击进入
5. 复制地址栏URL

---

## ❓ 五、常见问题

### Q1: 如果找不到"外国人入試"页面怎么办？

**A**: 可以尝试：
- 搜索"International Students"
- 查找"私費外国人留学生"
- 或者找到"入試要項"（招生简章）页面也可以

### Q2: 如果URL很长怎么办？

**A**: 没关系，复制完整的URL即可。例如：
```
https://www.u-tokyo.ac.jp/admission/undergraduate/foreign.html?lang=ja&tab=requirements
```
这样的长URL也可以。

### Q3: 如果找不到URL怎么办？

**A**: 
- 可以先留空
- 或者填写大学主页URL
- 后续可以补充

### Q4: 需要填写多个URL吗？

**A**: 
- **不需要！** 只需要一个主URL
- 爬虫会自动从主页面查找其他相关信息
- 如果某些信息在特定页面，可以后续补充

### Q5: 如何确认URL是否正确？

**A**: 
- 打开URL，应该能看到：
  - 招生信息
  - 出愿要求
  - 考试信息
  - 成绩要求
- 如果页面主要是这些内容，就是正确的

---

## 📋 六、填写清单

### 建议的填写顺序

**优先级1（最重要，先填写）**：
- 東京大学
- 京都大学
- 大阪大学
- 名古屋大学
- 九州大学
- 早稲田大学
- 慶應義塾大学

**优先级2（记录数多的大学）**：
- 東海大学（178条记录）
- 近畿大学（104条记录）
- 日本大学（92条记录）
- 関東学院大学（82条记录）
- ...（参考 `crawled_data/classification_info/existing_classifications.json`）

**优先级3（其他大学）**：
- 可以分批填写
- 每天填写10-20所
- 不需要一次性完成

---

## ✅ 七、填写完成后

### 检查清单

- [ ] 填写了至少10-20所大学的URL（可以开始测试）
- [ ] URL格式正确（以 http:// 或 https:// 开头）
- [ ] URL可以正常访问
- [ ] 保存了Excel文件

### 下一步

填写完成后，告诉我：
- "我已经填写了XX所大学的URL"
- 我会运行爬虫测试
- 根据结果优化代码

---

## 💡 八、小技巧

### 技巧1：使用浏览器书签

- 找到URL后，可以先保存为书签
- 方便后续检查和补充

### 技巧2：批量查找

- 可以一次性打开多个大学官网
- 分别找到URL
- 然后统一填写到Excel

### 技巧3：记录找不到的大学

- 如果某个大学找不到URL
- 可以在Excel中标记"未找到"
- 后续可以一起处理

---

*最后更新：2025-02-17*
