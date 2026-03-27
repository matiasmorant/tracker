import os
import subprocess
import zipfile
import sys
import time
from tqdm import tqdm
from google import genai

# Initialize Client
client = genai.Client()

def run_git(args):
    """Helper to run git commands and return output."""
    return subprocess.check_output(["git"] + args, text=True).strip()

def get_prompt(commit_id):
    parent_id = f"{commit_id}^"
    
    try:
        # 1. Get touched files and their status (Added, Modified, Deleted)
        # --diff-filter=d excludes deleted files from being 'read' from parent
        files_raw = run_git(["diff-tree", "-r", "--no-commit-id", "--name-status", commit_id])
        
        contents = []

        # 2. Process Files
        for line in files_raw.splitlines():
            status, f_path = line.split(None, 1)
            
            # We only care about files that existed BEFORE the commit (Modified/Deleted)
            if status in ('M', 'D'):
                try:
                    # Get file content from parent commit directly into memory
                    file_text = run_git(["show", f"{parent_id}:{f_path}"])
                    contents.append(f"--- PREVIOUS FILE: {f_path} ---\n{file_text}\n")
                except subprocess.CalledProcessError:
                    continue

        # 3. Get the Diff
        diff_text = run_git(["show", commit_id])
        contents.append(f"--- COMMIT DIFF ---\n{diff_text}")

        # 4. Query Gemini
        # Using a system_instruction keeps the logic separate from the data
        print(f"🚀 Analyzing {commit_id} with Gemini...")
        
        prompt = "Based on the provided previous file states and the diff, reconstruct the original prompt used to generate these changes. Return ONLY the prompt text."
        
        response = client.models.generate_content(
            model="gemini-3.1-flash-lite-preview", # Updated to latest lite naming
            contents=contents,
            config={
                "system_instruction": prompt
            }
        )

        ret=response.text.strip()
        print("\n--- RECONSTRUCTED PROMPT ---")
        print(ret)
        print("----------------------------\n")
        return ret

    except subprocess.CalledProcessError as e:
        print(f"Error executing git command: {e}")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python script.py <commit_id>")
    else:
        get_prompt(sys.argv[1])

# # git log --reverse --format="%h"
# commit_ids='4aa066f b03c129 c60805d bb24124 fe3ef10 9aaad7d fa0a242 42ef2ba 10a37b1 779c33c 36dc61e 59f1db8 6f55038 5c90810 0bdbd8e b6a2468 9bb4a9e 62528d5 e940d14 4aec0be d1b0f52 ca95232 4fe4b94 5b68007 ed9a323 ea244cc 7925665 7009658 ce94fbd 1891ddf e30256f 714ac81 b0d93f6 3c58ee6 e0948ac 750e7ed bf27de6 d8afa9f 4ac5cc7 d1df904 a198f47 2c3a7d5 7687162 70cf972 c2e1cad 72439e0 59a5be0 86d442f 56512ae 66945d5 c0267d5 89e78d4 358c8d9 409586c 1519e19 3b1682a deaf7ee 2ad0272 bc02ece da926fc fdeddfb 1d86cb0 69e151c c8636b2 7cca2e9 b31fa78 026e6ad aa55c11 294c3ab 274bdb1 4bb9fb8 68938f6 9fc842f 4a7f3a8 316c66a e6def8d a35310c 716fa1b 082fe58 b1b238a 1fe5112 1759d42 55ec5f4 ff6a224 f2564b9 456a182 31ea159 4213e83 a41a33d f665f82 348fbe0 9838973 5f4457b f6e43ab 4a6a310 241b599 f191919 8ea1994 77f7cc2 223fba0 7cd8e68 92d470c ac87943 0fc9204 abe6147 eae8845 19d3cd0 c6db4c6 706f695 ca7f472 6e55679 af0401b 55a4f02 a0cad57 d04de00 ee3a3d0 7e50460 04a163e 19bfe82 eb76ad3 6149c79 6a64cea cd5d890 460d1dc f64656f 063d604 99ad59f eeea277 cfd3966 e43ab5d 1b804f6 6afb407 3ea9088 d6e6348 0c6078c 42f33af e8c0daf 68dac73 8d5a386 70278e8 2506f23 21451a6 b6407e2 c634dd5 a12831c 9274d3d 471cbd8 c206330 dfd55f5 ed51832 c7c135a 0455db0 d9fb8d7 3fd4821 6a120eb aca7cd5 ec9342f 9dfae9b 0321682 50115b7 45e9701'
# commit_ids=commit_ids.split(' ')
# prompts={}
# for x in tqdm(commit_ids):
#     if x not in prompts:
#         p=get_prompt(x)
#         if p is not None:
#             prompts[x]=p
#         else: time.sleep(20)

# text="\n\n".join(["\n\n".join([f"# {i+1} - (commit {k})", prompts[k]]) for i, k in enumerate(commit_ids) if k in prompts ])
# Path('prompts.md').write_text(text) 