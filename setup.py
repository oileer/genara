from setuptools import setup, find_packages

setup(
    name="genara",
    version="0.1.0",
    packages=find_packages(),
    install_requires=["requests>=2.28.0"],
    entry_points={"console_scripts": ["genara=genara.core:main"]},
    python_requires=">=3.9",
)
