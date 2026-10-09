import subprocess
import os
import re

def update_readme(repo_dir, option_name):
    readme_path = os.path.join(repo_dir, "README.md")
    if not os.path.exists(readme_path):
        return

    # 1. Run Infracost scan on terraform/
    tf_dir = os.path.join(repo_dir, "infra/terraform")
    scan_res = subprocess.run(
        ["infracost", "scan", tf_dir, "--json"],
        capture_output=True, text=True
    )
    
    inspect_res = subprocess.run(
        ["infracost", "inspect", "--group-by", "resource"],
        capture_output=True, text=True
    )

    infracost_output = inspect_res.stdout.strip()
    if not infracost_output:
        infracost_output = "No costed resources detected."

    cost_section = f"""<!-- INFRACOST_START -->
### 💵 Kết quả Kiểm tra Chi phí Tự động (Infracost CI/CD Output)
*Thời gian kiểm tra: {subprocess.check_output(['date', '-u']).decode().strip()}*

```text
{infracost_output}
```
<!-- INFRACOST_END -->"""

    with open(readme_path, "r") as f:
        content = f.read()

    if "<!-- INFRACOST_START -->" in content:
        content = re.sub(
            r"<!-- INFRACOST_START -->.*?<!-- INFRACOST_END -->",
            cost_section,
            content,
            flags=re.DOTALL
        )
    else:
        # Append before section 3
        if "## 3. Kiến trúc Hạ tầng" in content:
            content = content.replace("## 3. Kiến trúc Hạ tầng", cost_section + "\n\n## 3. Kiến trúc Hạ tầng")
        else:
            content += "\n\n" + cost_section

    with open(readme_path, "w") as f:
        f.write(content)
    print(f"Updated README with Infracost cost for {option_name}")

if __name__ == "__main__":
    import sys
    update_readme(sys.argv[1], sys.argv[2])
