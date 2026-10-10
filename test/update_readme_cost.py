import subprocess
import os
import re

def update_readme(repo_dir, option_name):
    readme_path = os.path.join(repo_dir, 'README.md')
    if not os.path.exists(readme_path):
        return

    cfn_file = os.path.join(repo_dir, 'infra/cloudformation.yaml')
    if not os.path.exists(cfn_file):
        cfn_file = os.path.join(repo_dir, 'infra/modules/app.yaml')

    subprocess.run(['infracost', 'scan', cfn_file, '--json'], capture_output=True, text=True)
    inspect_res = subprocess.run(['infracost', 'inspect', '--group-by', 'resource'], capture_output=True, text=True)

    infracost_output = inspect_res.stdout.strip()
    if not infracost_output:
        infracost_output = 'No costed resources detected.'

    date_str = subprocess.check_output(['date', '-u']).decode().strip()
    cost_section = (
        "<!-- INFRACOST_START -->\n"
        "### 💵 Automated CloudFormation Cost Scan (Infracost CI/CD Output)\n"
        f"*Scan timestamp: {date_str}*\n\n"
        "```text\n"
        f"{infracost_output}\n"
        "```\n"
        "<!-- INFRACOST_END -->"
    )

    with open(readme_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Clean out any old Terraform state section
    if '## 🔒 Bảo Mật & Quản Lý Trạng Thái' in content:
        parts = content.split('## 🔒 Bảo Mật & Quản Lý Trạng Thái')
        content = parts[0]

    cfn_state_text = (
        "## ☁️ Native AWS CloudFormation Infrastructure Management (No State File)\n"
        "The infrastructure is managed 100% via **AWS CloudFormation Native**:\n"
        "- **AWS-Managed State:** Resource state is directly managed by the AWS CloudFormation engine.\n"
        "- **Zero State File Overhead:** Eliminates state locking, secret leakage, and remote backend synchronization issues (no S3/DynamoDB locks needed).\n"
        "- **Drift Detection:** Enables automated drift detection directly from the AWS Console and AWS CLI.\n"
    )

    if '<!-- INFRACOST_START -->' in content:
        content = re.sub(
            r'<!-- INFRACOST_START -->.*?<!-- INFRACOST_END -->',
            cost_section,
            content,
            flags=re.DOTALL
        )
    else:
        if '## 3. Architecture Overview' in content:
            content = content.replace('## 3. Architecture Overview', cost_section + '\n\n## 3. Architecture Overview')
        elif '## 3. Kiến trúc Hạ tầng' in content:
            content = content.replace('## 3. Kiến trúc Hạ tầng', cost_section + '\n\n## 3. Kiến trúc Hạ tầng')
        else:
            content += '\n\n' + cost_section

    if '## ☁️ Native AWS CloudFormation' not in content and '## ☁️ Quản Lý Hạ Tầng' not in content:
        content += '\n' + cfn_state_text

    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Successfully updated README for {option_name}')

if __name__ == '__main__':
    import sys
    update_readme(sys.argv[1], sys.argv[2])
