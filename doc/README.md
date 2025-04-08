To compile 

create HTML
```
> docker run -v /path/to/this/folder:/documents asciidoctor/docker-asciidoctor asciidoctor AsciidocFile.adoc
```

create word docx in two steps
```
> docker run -v /path/top/this/folder:/documents asciidoctor/docker-asciidoctor asciidoctor -b docbook AsciidocFile.adoc
> docker run -v /path/top/this/folder:/data pandoc/latex -r docbook -t docx -o AsciidocFile.docx AsciidocFile.xml
```
