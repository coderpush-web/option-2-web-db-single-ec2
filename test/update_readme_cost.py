import subprocess
import os
import re

def update_readme(repo_dir, option_name):
    readme_path = os.path.join(repo_dir, "README.md")
    if not os.path.exists(readme_path):
        return

    cfn_file = os.path.join(repo_dir, "infra/cloudformation.yaml")
    if not os.path.exists(cfn_file):
        cfn_file = os.path.join(repo_dir, "infra/modules/app.yaml")

    subprocess.run(["infracost", "scan", cfn_file, "--json"], capture_output=True, text=True)
    inspect_res = subprocess.run(["infracost", "inspect", "--group-by", "resource"], capture_output=True, text=True)

    infracost_output = inspect_res.stdout.strip()
    if not infracost_output:
        infracost_output = "No costed resources detected."

    cost_section = f"""<!-- INFRACOST_START -->
### 💵 Kết quả Kiểm tra Chi phí Tự động CloudFormation (Infracost CI/CD Output)
*Thời gian kiểm tra: {subprocess.check_output(['date', '-u']).decode().strip()}*

```text
{infracost_output}
```
<!-- INFRACOST_END -->"""

    with open(readme_path, "r") as f:
        content = f.read()

    content = re.sub(r"## 🔒 Bảo Mật & Quản Lý Trạng Thái.*?(?=
## |\Z)", "", content, flags=re.DOTALL)

    cfn_state_text = """## ☁️ Quản Lý Hạ Tầng Native CloudFormation (No State File)
Hạ tầng sử dụng 100% **AWS CloudFormation Native**:
- **State Managed by AWS:** Toàn bộ trạng thái tài nguyên do AWS quản lý tự động trực tiếp trên CloudFormation Engine.
- **Không cần lưu trữ State File:** Loại bỏ hoàn toàn rủi ro lộ bí mật, mất đồng bộ hoặc conflict state file (không cần S3/DynamoDB).
- **Drift Detection:** Cho phép kiểm tra độ lệch cấu hình trực tiếp từ AWS Console / AWS CLI mà không lo hỏng state.
"""

    if "<!-- INFRACOST_START -->" in content:
        content = re.sub(
            r"<!-- INFRACOST_START -->.*?<!-- INFRACOST_END -->",
            cost_section,
            content,
            flags=re.DOTALL
        )
    else:
        if "## 3. Kiến trúc Hạ tầng" in content:
            content = content.replace("## 3. Kiến trúc Hạ tầng", cost_section + "\n\n## 3. Kiến trúc Hạ tầng")
        else:
            content += "\n\n" + cost_section

    if "## ☁️ Quản Lý Hạ Tầng Native CloudFormation" not in content:
        content += "\n" + cfn_state_text

    with open(readme_path, "w") as f:
        f.write(content)
    print(f"Updated README for {option_name}")

if __name__ == "__main__":
    import sys
    update_readme(sys.argv[1], sys.argv[2])
