import {
  Plugin,
  showMessage,
  Menu,
  getFrontend 
} from "siyuan";
import * as api from "./api";
import "@/index.scss";
import { SettingUtils } from "./libs/setting-utils";
import imageCompression from 'browser-image-compression';

const STORAGE_NAME = "config";

export default class PluginSample extends Plugin {
  private imageMap; // 新增图片映射表;
  private topBarMenu: Menu | null = null;

  private currentRepoPath: string; // 当前仓库路径
  private imagesavepath: any; // 新增图片保存路径属性
  private settingUtils: SettingUtils;
  private imageSuffix = "webp"; // 新增图片后缀属性
  private imageConverterStatus = false; //是否压缩图片
  private resourceArchiveStatus = true; // 是否启用资源归档
  private deleteOriginalStatus = true; // 是否删除原图
  private currentPageId: string; //当前页面id
  private isMobile: boolean; // 是否为移动端
  private options = {
    1: "webp",
    2: "avif",
  };

  async install() {
  }

  async onload() {
    //console.log("插件加载成功");
    this.imageMap = new Set();
    //获取仓库路径
    this.GetRepoPath();
    //编辑器切换事件
    this.eventBus.on("switch-protyle", async (data) => {
      this.currentPageId = data.detail.protyle.block.rootID;
      await this.getImageSavePath(data.detail.protyle);
    });
    
    //编辑区点击事件
    this.eventBus.on("click-editorcontent", async (data) => {
      this.currentPageId = data.detail.protyle.block.rootID;
      await this.getImageSavePath(data.detail.protyle);
    });
		//this.eventBus.on("open-menu-link", this.injectContextMenu); // 注入右键菜单
		this.eventBus.on("open-menu-doctree", this.injectContextMenu);
    //this.eventBus.on("open-menu-content",this.injectContextMenu); //笔记本上右键菜单
    this.eventBus.on("click-editortitleicon",this.injectContextMenu); //文档右上角的 文件 按钮 菜单


    const frontEnd = getFrontend();
    this.isMobile = frontEnd === "mobile" || frontEnd === "browser-mobile";

    this.registerSettingUI();
    this.addClickTopBar();
  }

  private async addClickTopBar() {
    

    const topBar = this.addTopBar({
      icon: "iconEmoji",
      title: this.i18n.topBarTitle,
      position: "right",
      callback: async () => {
        if (this.isMobile) {
          this.addMenu(null);
        } else {
          let rect = topBar.getBoundingClientRect();
          // 如果被隐藏，则使用更多按钮
          if (rect.width === 0) {
              rect = document.querySelector("#barMore").getBoundingClientRect();
          }
          if (rect.width === 0) {
              rect = document.querySelector("#barPlugins").getBoundingClientRect();
          }
          this.addMenu(rect);
        }
      },
    });
  }
  private injectContextMenu = ({detail}:any) => {
    const submenu: any[] = [];
    submenu.push({
      icon: "iconImage",
      label: this.i18n.compressImage,
      click: async () => {
        this.imageMap = [];
        this.imageMap = await this.GetImageBlock(this.currentPageId);
        if (this.imageConverterStatus) {
          this.SwapAllImages();
        } else {
          this.swapAllImageSrc()
        }
      }
    });
    submenu.push({
      icon: "iconFolder",
      label: this.i18n.archiveImage,
      click: async () => {
        const previousImageConverterStatus = this.imageConverterStatus;
        this.imageConverterStatus = false;
        try {
          this.imageMap = [];
          this.imageMap = await this.GetImageBlock(this.currentPageId);
          await this.swapAllImageSrc();
        } finally {
          this.imageConverterStatus = previousImageConverterStatus;
        }
      }
    });
    submenu.push({
      icon: "iconUndo",
      label: this.i18n.canlelArchive,
      click: async () => {
        await this.cancelArchiveCurrentDoc();
      }
    });
    detail.menu.addItem({
      icon: "iconEmoji",
      title: this.i18n.topBarTitle,
      submenu: submenu
    });
  }
  public async addMenu(rect: any) {
    this.topBarMenu = new Menu("imageConverter", () => {
    });
    this.topBarMenu.addItem({
      icon: "iconImage",
      label: this.i18n.compressImage,
      click: async () => {
        this.imageMap = [];
        this.imageMap = await this.GetImageBlock(this.currentPageId);
        if (this.imageConverterStatus) {
          this.SwapAllImages();
        } else {
          this.swapAllImageSrc()
        }
      }
    });

    this.topBarMenu.addItem({
      icon: "iconFolder",
      label: this.i18n.archiveImage,
      click: async () => {
        const previousImageConverterStatus = this.imageConverterStatus;
        this.imageConverterStatus = false;
        try {
          this.imageMap = [];
          this.imageMap = await this.GetImageBlock(this.currentPageId);
          await this.swapAllImageSrc();
        } finally {
          this.imageConverterStatus = previousImageConverterStatus;
        }
      }
    });
    this.topBarMenu.addItem({
      icon: "iconUndo",
      label: this.i18n.canlelArchive,
      click: async () => {
        await this.cancelArchiveCurrentDoc();
      }
    });
    if (this.isMobile) {
      this.topBarMenu.fullscreen();
    } else {
      this.topBarMenu.open({
        x: rect.x,
        y: rect.y,
        isLeft: false
      });
    }
  }


  public async GetImageBlock(blockid) {
    var li = [];
    const data = await api.sql(`SELECT * FROM spans where root_id='${blockid}'`);
    // console.log(data);
    data.forEach(item => {
      // console.log(item["markdown"]);
      const match = item["markdown"]?.match(/!\[.*?\]\((.*?)\)/);
      if (!match) return;
      var filePath = match[1]
      const lowerPath = filePath.toLowerCase();
      // 仅处理本地资源，跳过网络/外部资源
      if (
        lowerPath.startsWith("http://") ||
        lowerPath.startsWith("https://") ||
        lowerPath.startsWith("data:") ||
        lowerPath.startsWith("file://")
      ) {
        return;
      }
      var filePathList = filePath.split("/")
      //获取图片文件后缀
      var filePathList = filePathList[filePathList.length - 1].split(".")
      var fileSuffix = filePathList[1]
      var fileName = filePathList[0]
      //根据设置情况判断获取哪些图片
      if (this.imageConverterStatus) {
        if (this.addImageToMap(fileSuffix)) {
          li.push({
            "block_id": item["block_id"],
            "markdown": item["markdown"],
            "file": null,
            "old_path": filePath,
            "image_name": fileName,
            "image_suffix": this.imageSuffix
          })
        }
      } else {
        if (filePathList.length == 2) {
          if (this.addImageToMap(fileSuffix)) {
            li.push({
              "block_id": item["block_id"],
              "markdown": item["markdown"],
              "file": null,
              "old_path": filePath,
              "image_name": fileName,
              "image_suffix": fileSuffix
            })
          }
        }
      }
    })
    // console.log(li);
    return li;
  }

  private isLocalResourcePath(path: string): boolean {
    const lowerPath = String(path || "").toLowerCase();
    if (
      lowerPath.startsWith("http://") ||
      lowerPath.startsWith("https://") ||
      lowerPath.startsWith("data:") ||
      lowerPath.startsWith("file://")
    ) {
      return false;
    }
    return true;
  }

  /**
   * 取消归档：把当前文档中归档到 this.imagesavepath 下的图片移动回 assets 根目录
   * 仅处理本地资源，跳过网络图片
   */
  public async cancelArchiveCurrentDoc() {
    const archivePrefix = (this.imagesavepath ? String(this.imagesavepath) : "").replace(/\/+$/, "") + "/";
    if (!this.currentPageId || !archivePrefix || archivePrefix === "/") return;

    const rows = await api.sql(`SELECT block_id, markdown FROM spans WHERE root_id='${this.currentPageId}'`);
    if (!rows?.length) {
      console.log("没有图片需要取消归档",this.currentPageId);
      return;
    }
    console.log("需要取消归档的图片",rows,this.currentPageId);
    // 确保 assets 根目录存在
    await api.putFile("data/assets", true, null);

    for (const row of rows) {
      const md: string = row?.markdown || "";
      const match = md.match(/!\[.*?\]\((.*?)\)/);
      if (!match) continue;

      const oldPath = match[1];
      if (!this.isLocalResourcePath(oldPath)) continue;
      const path_split = String(oldPath).split("/");
      if (path_split.length < 3) continue;

      //if (!oldPath.startsWith(archivePrefix)) continue;

      const fileNameWithExt = path_split.pop() || "";
      const newPath = `assets/${fileNameWithExt}`;

      // 不改名：如遇同名冲突则跳过，避免覆盖
      const existing = await api.getFileBlob("data/" + newPath);
      if (existing) {
        console.log("新路径已存在",newPath);
        //continue;
      }

      await api.request("/api/file/renameFile", {
        path: "data/" + oldPath,
        newPath: "data/" + newPath,
      });

      const newMarkdown = md.replace(oldPath, newPath);
      await api.updateBlock("markdown", newMarkdown, row.block_id);
    }
  }

  public addImageToMap(suffix) {
    if (suffix !== this.imageSuffix) {
      return true
    }
    return false
  }

  public sanitizePath(str: string): string {
    return str.replace(/[\\/:*?"<>|]/g, '_') // 替换非法字符为下划线
      .replace(/\s+/g, '-')          // 空格转短横线
      .replace(/_+/g, '_')            // 合并连续下划线
      .replace(/-+/g, '-')            // 合并连续短横线
      .replace(/^[_.-]+/, '')        // 去除开头特殊符号
      .replace(/[_.-]+$/, '');        // 去除结尾特殊符号
  }

  public async swapAllImageSrc() {
    //获取图片文件补充到map中
    for (let index = 0; index < this.imageMap.length; index++) {
      const element = this.imageMap[index];
      console.log(this.i18n.readingImage.replace("${index}", String(index + 1)));
      var file = await this.pathToFile(this.currentRepoPath + "/" + element["markdown"].match(/!\[.*?\]\((.*?)\)/)[1])
      this.imageMap[index]["file"] = file
    }
    showMessage(this.i18n.readComplete + "(" + this.imageMap.length + "张)");
    //创建目录
    await api.putFile("data/" + this.imagesavepath, true, null)
    //移动图片并更新图片块
    this.imageMap.forEach(async item => {
      const newPath = this.imagesavepath + "/" + item.image_name + "." + item.image_suffix
      var markdown = item.markdown
      markdown = markdown.replace(item.old_path, newPath)
      await api.updateBlock("markdown", markdown, item.block_id)
      if (this.deleteOriginalStatus) {
        await api.request(
          "/api/file/renameFile",
          {
            "path": "data/" + item.old_path,
            "newPath": "data/" + newPath
          }
        )
      } else {
        await api.putFile("data/" + newPath, false, item.file);
      }
    })
  }

  public async SwapAllImages() {
    //获取图片文件补充到map中
    for (let index = 0; index < this.imageMap.length; index++) {
      const element = this.imageMap[index];
      //showMessage(this.i18n.readingImage.replace("${index}", String(index + 1)))
      var file = await this.pathToFile(this.currentRepoPath + "/" + element["markdown"].match(/!\[.*?\]\((.*?)\)/)[1])
      this.imageMap[index]["file"] = file
    }
    showMessage(this.i18n.readComplete + "(" + this.imageMap.length + "张)");
    // console.log(this.imageMap)
    if (this.imageConverterStatus) {
      //压缩图片
      // 使用Promise.all并行处理
      const compressPromises = this.imageMap.map(async (element, index) => {
        console.log(this.i18n.compressingImage.replace("${index}", String(index + 1)));
        const tempfile = await this.compressImage(element.file);
        return { index, file: tempfile.file };
      });

      const results = await Promise.all(compressPromises);
      results.forEach(({ index, file }) => {
        this.imageMap[index].file = file;
      });
      // console.log(this.imageMap)
      showMessage(this.i18n.compressComplete)
    }
    if (this.resourceArchiveStatus) {
      // 上传到归档资源目录
      var filesList = []
      this.imageMap.forEach(item => {
        filesList.push(item["file"])
      })
      var tmpFileList = (await api.upload(this.imagesavepath, filesList)).succMap

      // 更新imageMap中的markdown
      for (let index = 0; index < this.imageMap.length; index++) {
        const element = this.imageMap[index];
        var markdown = element.markdown;
        console.log(element)
        markdown = markdown.replace(element.old_path, tmpFileList[element.image_name + "." + this.imageSuffix])
        this.imageMap[index].markdown = markdown
      }

      // 更新块并删除旧图
      for (let index = 0; index < this.imageMap.length; index++) {
        const element = this.imageMap[index];
        await api.updateBlock("markdown", element.markdown, element.block_id)
        //if (this.deleteOriginalStatus) {
          await api.removeFile("data/" + element.old_path)
        //}
      }
    } else {
      // 不归档：压缩后仍保存在原目录
      for (let index = 0; index < this.imageMap.length; index++) {
        const element = this.imageMap[index];
        const oldPath = element.old_path as string;
        const slashIndex = oldPath.lastIndexOf("/");
        const parentDir = slashIndex >= 0 ? oldPath.substring(0, slashIndex) : "";
        const newPath = (parentDir ? parentDir + "/" : "") + element.image_name + "." + this.imageSuffix;

        await api.putFile("data/" + newPath, false, element.file);

        let markdown = element.markdown;
        markdown = markdown.replace(element.old_path, newPath);
        await api.updateBlock("markdown", markdown, element.block_id);

        if (newPath !== oldPath && this.deleteOriginalStatus) {
          await api.removeFile("data/" + oldPath);
        }
      }
    }
  }

  // public async SwapImage(filemap: any) {
  //   const [srcpath, html, file] = filemap;
  //   //console.log(this.imagesavepath)
  //   const response = await api.upload(this.imagesavepath + ".assets", [file])
  //   //console.log(response.succMap)
  // }

  async compressImage(file: File): Promise<{ file: File; ratio: number }> {

    const options = {
      maxSizeMB: 0.75, // 最大文件大小
      maxWidthOrHeight: 1920, // 最大宽度或高度
      useWebWorker: true, // 使用 Web Worker 提高性能
      fileType: "image/" + this.imageSuffix, // 输出格式为 webp
    };

    try {
      const compressedFile = await imageCompression(file, options);
      const ratio = Math.round((1 - compressedFile.size / file.size) * 100);

      // 保持原文件名，但改为.webp后缀
      const newFileName =
        file.name.replace(/\.[^/.]+$/, "") + "." + this.imageSuffix;
      const finalFile = new File([compressedFile], newFileName, {
        type: "image/" + this.imageSuffix,
      });

      return {
        file: finalFile,
        ratio: ratio,
      };

    } catch (error) {
      console.error(this.i18n.compressFailed, error);
      return {
        file: file,
        ratio: 0,
      };
    }
  }

  private async pathToFile(imagePath: string): Promise<File> {
    const fs = require("fs").promises;
    const path = require("path");
    // 读取文件
    const buffer = await fs.readFile(imagePath);
    // 获取文件名
    const fileName = path.basename(imagePath);
    // 获取 MIME 类型
    const mimeType =
      {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
        ".avif": "image/avif"
      }[path.extname(imagePath).toLowerCase()] || "application/octet-stream";

    // 创建 File 对象
    try {
      const file = new File([buffer], fileName, { type: mimeType });
      return file;
    } catch (e) {
      showMessage(e.message);
    }
    return null;
  }

  public async GetPagePath(id) {
    const result = await api.getHPathByID(id)
    return result;
  }

  public async GetNotebookName(id) {
    const result = await api.getNotebookConf(id)
    return result.name;
  }

  public GetRepoPath() {
    this.currentRepoPath = window.siyuan.config.system.dataDir;
  }

  private async registerSettingUI() {
    this.settingUtils = new SettingUtils({
      plugin: this,
      name: STORAGE_NAME,
    });
    this.settingUtils.addItem({
      key: "imageConverterStatus",
      value: false,
      type: "checkbox",
      title: this.i18n.settingImageCompressionTitle,
      description: this.i18n.settingImageCompressionDesc,
      action: {
        callback: async () => {
          let value = await this.settingUtils.takeAndSave(
            "imageConverterStatus"
          );
          if (value) {
            this.imageConverterStatus = true;
            showMessage(this.i18n.imageCompressionEnabled);
          } else {
            this.imageConverterStatus = false;
            showMessage(this.i18n.imageCompressionDisabled);
          }
        },
      },
    });
    this.settingUtils.addItem({
      key: "saveSuffix",
      value: 1,
      type: "select",
      title: this.i18n.settingSaveSuffixTitle,
      description: this.i18n.settingSaveSuffixDesc,
      options: this.options,
      action: {
        callback: async () => {
          let value = await this.settingUtils.takeAndSave("saveSuffix");
          this.imageSuffix = this.options[value];
        },
      },
    });
    this.settingUtils.addItem({
      key: "resourceArchiveStatus",
      value: true,
      type: "checkbox",
      title: this.i18n.settingResourceArchiveTitle,
      description: this.i18n.settingResourceArchiveDesc,
      action: {
        callback: async () => {
          let value = await this.settingUtils.takeAndSave("resourceArchiveStatus");
          this.resourceArchiveStatus = value;
          if (value) {
            this.deleteOriginalStatus = true;
            await this.settingUtils.setAndSave("deleteOriginalStatus", true);
            this.settingUtils.disable("deleteOriginalStatus");
            showMessage(this.i18n.resourceArchiveEnabled);
          } else {
            this.settingUtils.enable("deleteOriginalStatus");
            showMessage(this.i18n.resourceArchiveDisabled);
          }
        },
      },
    });
    this.settingUtils.addItem({
      key: "deleteOriginalStatus",
      value: true,
      type: "checkbox",
      title: this.i18n.settingDeleteOriginalTitle,
      description: this.i18n.settingDeleteOriginalDesc,
      action: {
        callback: async () => {
          let value = await this.settingUtils.takeAndSave("deleteOriginalStatus");
          this.deleteOriginalStatus = value;
          if (value) {
            showMessage(this.i18n.deleteOriginalEnabled);
          } else {
            showMessage(this.i18n.deleteOriginalDisabled);
          }
        },
      },
    });
    try {
      //加载之前的设置
      let value = await this.settingUtils.load();
      this.imageSuffix = this.options[value["Select"]] || "webp";
      this.imageConverterStatus = value["imageConverterStatus"] || false;
      this.resourceArchiveStatus = value["resourceArchiveStatus"] ?? true;
      this.deleteOriginalStatus = value["deleteOriginalStatus"] ?? true;
      if (this.resourceArchiveStatus) {
        this.deleteOriginalStatus = true;
        await this.settingUtils.setAndSave("deleteOriginalStatus", true);
        this.settingUtils.disable("deleteOriginalStatus");
      } else {
        this.settingUtils.enable("deleteOriginalStatus");
      }
    } catch (e) {
      //console.error(e);
    }
  }

  //获取当前标签页id、笔记本id、保存路径
  public async getImageSavePath(protyle) {
    if (!protyle?.block?.rootID || !protyle?.notebookId) {
      return;
    }

    //获取当前页面id
    
    const pagepath = (await this.GetPagePath(this.currentPageId)) || "";
    //获取笔记本名字
    const notebookname = (await this.GetNotebookName(protyle.notebookId)) || "";

    const parts = [notebookname, ...String(pagepath).split("/").filter(Boolean)]
      .map((p) => this.sanitizePath(String(p)))
      .filter(Boolean);

    //保存路径
    this.imagesavepath = "assets/" + parts.join("/");
  }
}