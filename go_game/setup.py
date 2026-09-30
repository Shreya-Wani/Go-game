"""
Setup script for the Go Game package.
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="go-game-ai",
    version="1.0.0",
    author="Go Game Development Team",
    author_email="developer@example.com",
    description="A modern Go game implementation with AI players",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/go-game-ai",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Education",
        "Intended Audience :: End Users/Desktop",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Games/Entertainment :: Board Games",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    python_requires=">=3.8",
    install_requires=requirements,
    entry_points={
        "console_scripts": [
            "go-game=main:main",
        ],
    },
    keywords="go game ai minimax alpha-beta board-game artificial-intelligence",
    project_urls={
        "Bug Reports": "https://github.com/yourusername/go-game-ai/issues",
        "Source": "https://github.com/yourusername/go-game-ai",
        "Documentation": "https://github.com/yourusername/go-game-ai/wiki",
    },
)
