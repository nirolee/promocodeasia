#!/usr/bin/env python3
"""旧命令入口：先列到期来源，不再依赖家里或公司 Chrome 隧道。"""
import runpy
import sys
from pathlib import Path

if len(sys.argv) == 1:
    sys.argv.append('plan')
runpy.run_path(str(Path(__file__).with_name('coupon-sync.py')), run_name='__main__')
