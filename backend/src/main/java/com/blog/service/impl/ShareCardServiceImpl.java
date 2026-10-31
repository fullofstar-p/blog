package com.blog.service.impl;

import com.blog.common.BusinessException;
import com.blog.common.ResultCode;
import com.blog.mapper.ArticleMapper;
import com.blog.service.ArticleTagAssembler;
import com.blog.service.ShareCardService;
import com.blog.vo.ArticleDetailVO;
import com.blog.vo.TagVO;
import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import javax.imageio.ImageIO;
import java.awt.BasicStroke;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.GraphicsEnvironment;
import java.awt.RenderingHints;
import java.awt.geom.AffineTransform;
import java.awt.geom.Path2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * 分享卡片实现：Java2D 绘制手绘风 1200×630 PNG。
 *
 * <p>中文字体：容器内安装 fontconfig + fonts-noto-cjk；本地 Windows 回退到微软雅黑，
 * 都找不到时用逻辑字体 Serif（JDK 逻辑字体会做缺字回退）。</p>
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class ShareCardServiceImpl implements ShareCardService {

    private static final int WIDTH = 1200;
    private static final int HEIGHT = 630;

    /** 纸张底色 */
    private static final Color PAPER = new Color(0xF5, 0xF0, 0xE8);
    /** 铅笔灰 */
    private static final Color PENCIL = new Color(0x2C, 0x2C, 0x2C);
    /** 次级文字 */
    private static final Color MUTED = new Color(0x6B, 0x63, 0x58);
    /** 正文文字 */
    private static final Color TEXT = new Color(0x3A, 0x36, 0x30);
    /** 低饱和强调色 */
    private static final Color ACCENT_RED = new Color(0xE7, 0x4C, 0x3C);
    private static final Color ACCENT_BLUE = new Color(0x34, 0x98, 0xDB);
    /** 纸张纹理线 */
    private static final Color PAPER_LINE = new Color(0xD8, 0xD0, 0xC2);

    private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final String FONT_FAMILY = resolveFontFamily();

    private final ArticleMapper articleMapper;
    private final ArticleTagAssembler articleTagAssembler;

    @Value("${blog.site-name:技术分享博客}")
    private String siteName;

    /** 启动时打印一次实际渲染字体，便于排查容器内中文字体缺失 */
    @PostConstruct
    public void logSelectedFont() {
        boolean cjkAvailable = new Font(FONT_FAMILY, Font.PLAIN, 24)
                .canDisplayUpTo("中文标题摘要分类标签") == -1;
        log.info("分享卡片渲染字体：{}（CJK 可显示：{}）", FONT_FAMILY, cjkAvailable);
    }

    @Override
    public byte[] render(Long articleId) {
        ArticleDetailVO article = articleMapper.selectDetailById(articleId);
        if (article == null || !Integer.valueOf(1).equals(article.getStatus())) {
            throw new BusinessException(ResultCode.NOT_FOUND, "文章不存在或未发布");
        }
        articleTagAssembler.fill(List.of(article));

        BufferedImage image = new BufferedImage(WIDTH, HEIGHT, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = image.createGraphics();
        try {
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            // 纸张底色 + 纹理
            g.setColor(PAPER);
            g.fillRect(0, 0, WIDTH, HEIGHT);
            drawPaperTexture(g);
            // 整体轻微倾斜，保留手绘素描本的不稳定感
            AffineTransform original = g.getTransform();
            g.rotate(Math.toRadians(-0.4), WIDTH / 2.0, HEIGHT / 2.0);
            drawSketchBorder(g);
            drawContent(g, article);
            g.setTransform(original);
        } finally {
            g.dispose();
        }
        try (ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            ImageIO.write(image, "png", out);
            return out.toByteArray();
        } catch (IOException e) {
            log.error("生成分享卡片失败，articleId={}", articleId, e);
            throw new BusinessException(ResultCode.ERROR, "分享卡片生成失败");
        }
    }

    /** 纸张纹理：大量短浅色线条，模拟素描纸颗粒 */
    private void drawPaperTexture(Graphics2D g) {
        Random random = new Random(20261101L);
        g.setColor(PAPER_LINE);
        g.setStroke(new BasicStroke(1f));
        for (int i = 0; i < 700; i++) {
            int x = random.nextInt(WIDTH);
            int y = random.nextInt(HEIGHT);
            int len = 6 + random.nextInt(26);
            g.drawLine(x, y, Math.min(WIDTH, x + len), y + random.nextInt(3) - 1);
        }
    }

    /** 两条虚线边框叠加，模拟手绘线框 */
    private void drawSketchBorder(Graphics2D g) {
        g.setColor(PENCIL);
        g.setStroke(new BasicStroke(3f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER,
                10f, new float[]{12f, 7f}, 0f));
        g.drawRoundRect(38, 34, WIDTH - 76, HEIGHT - 68, 6, 6);
        g.setColor(new Color(44, 44, 44, 110));
        g.setStroke(new BasicStroke(1.5f, BasicStroke.CAP_BUTT, BasicStroke.JOIN_MITER,
                10f, new float[]{8f, 6f}, 0f));
        g.drawRoundRect(46, 42, WIDTH - 92, HEIGHT - 84, 6, 6);
    }

    /** 卡片正文布局 */
    private void drawContent(Graphics2D g, ArticleDetailVO article) {
        int left = 100;
        int right = WIDTH - 100;
        int contentWidth = right - left;

        Font metaFont = new Font(FONT_FAMILY, Font.PLAIN, 22);
        Font titleFont = new Font(FONT_FAMILY, Font.BOLD, 46);
        Font summaryFont = new Font(FONT_FAMILY, Font.PLAIN, 27);
        Font tagFont = new Font(FONT_FAMILY, Font.PLAIN, 21);

        // 顶部：分类（左）+ 站点名（右）
        g.setFont(metaFont);
        String category = StringUtils.hasText(article.getCategoryName())
                ? "分类 / " + article.getCategoryName() : "";
        if (!category.isEmpty()) {
            g.setColor(ACCENT_BLUE);
            g.drawString(category, left, 112);
        }
        g.setColor(MUTED);
        String site = siteName == null ? "" : siteName;
        g.drawString(site, right - g.getFontMetrics().stringWidth(site), 112);

        // 标题：最多 3 行 + 红色波浪下划线
        g.setFont(titleFont);
        g.setColor(PENCIL);
        FontMetrics titleMetrics = g.getFontMetrics();
        List<String> titleLines = wrapText(titleMetrics, article.getTitle(), contentWidth, 3);
        int titleBaseline = 196;
        for (String line : titleLines) {
            g.drawString(line, left, titleBaseline);
            titleBaseline += 64;
        }
        int lastTitleBaseline = titleBaseline - 64;
        if (!titleLines.isEmpty()) {
            int underlineWidth = Math.min(contentWidth,
                    titleMetrics.stringWidth(titleLines.get(titleLines.size() - 1)));
            drawWavyUnderline(g, left, left + underlineWidth, lastTitleBaseline + 16);
        }

        // 摘要：最多 2 行
        g.setFont(summaryFont);
        g.setColor(TEXT);
        FontMetrics summaryMetrics = g.getFontMetrics();
        List<String> summaryLines = wrapText(summaryMetrics,
                plainText(article.getSummary()), contentWidth, 2);
        int summaryBaseline = Math.max(lastTitleBaseline + 62, 356);
        for (String line : summaryLines) {
            g.drawString(line, left, summaryBaseline);
            summaryBaseline += 42;
        }

        // 标签
        g.setFont(tagFont);
        g.setColor(ACCENT_BLUE);
        String tags = tagsText(article.getTags());
        if (!tags.isEmpty()) {
            g.drawString(tags, left, 512);
        }

        // 作者 / 日期 + 底部提示
        g.setFont(metaFont);
        g.setColor(MUTED);
        String author = StringUtils.hasText(article.getAuthorName()) ? article.getAuthorName() : "匿名";
        String date = article.getCreateTime() == null
                ? "" : article.getCreateTime().format(DATE_FORMATTER);
        g.drawString("文 / " + author + (date.isEmpty() ? "" : "      " + date), left, 560);
        g.setColor(ACCENT_RED);
        String hint = "阅读全文 ->";
        g.drawString(hint, right - g.getFontMetrics().stringWidth(hint), 560);
    }

    /** 手绘波浪下划线 */
    private void drawWavyUnderline(Graphics2D g, int startX, int endX, int y) {
        if (endX <= startX) {
            return;
        }
        g.setColor(ACCENT_RED);
        g.setStroke(new BasicStroke(3f, BasicStroke.CAP_ROUND, BasicStroke.JOIN_ROUND));
        Path2D.Double path = new Path2D.Double();
        path.moveTo(startX, y);
        boolean up = true;
        for (double x = startX; x < endX; x += 12) {
            double next = Math.min(x + 12, endX);
            path.quadTo(x + 6, y + (up ? -5 : 5), next, y);
            up = !up;
        }
        g.draw(path);
    }

    /** 按像素宽度换行，最多 maxLines 行，超出加省略号 */
    private List<String> wrapText(FontMetrics metrics, String raw, int maxWidth, int maxLines) {
        List<String> lines = new ArrayList<>();
        if (raw == null || raw.isBlank() || maxLines <= 0) {
            return lines;
        }
        String text = raw.replace('\r', ' ').replace('\n', ' ')
                .replaceAll("\\s+", " ").trim();
        StringBuilder line = new StringBuilder();
        boolean truncated = false;
        for (int i = 0; i < text.length(); ) {
            int codePoint = text.codePointAt(i);
            String ch = new String(Character.toChars(codePoint));
            if (metrics.stringWidth(line + ch) > maxWidth && line.length() > 0) {
                if (lines.size() == maxLines - 1) {
                    truncated = true;
                    break;
                }
                lines.add(line.toString());
                line.setLength(0);
            }
            line.append(ch);
            i += Character.charCount(codePoint);
        }
        if (line.length() > 0 && lines.size() < maxLines) {
            lines.add(line.toString());
        }
        if (truncated && !lines.isEmpty()) {
            int last = lines.size() - 1;
            lines.set(last, ellipsize(metrics, lines.get(last), maxWidth));
        }
        return lines;
    }

    private String ellipsize(FontMetrics metrics, String text, int maxWidth) {
        String dots = "...";
        if (metrics.stringWidth(text + dots) <= maxWidth) {
            return text + dots;
        }
        StringBuilder builder = new StringBuilder(text);
        while (builder.length() > 0 && metrics.stringWidth(builder + dots) > maxWidth) {
            builder.deleteCharAt(builder.length() - 1);
        }
        return builder + dots;
    }

    /** 摘要去 Markdown 标记，避免卡片出现大量符号 */
    private String plainText(String raw) {
        if (!StringUtils.hasText(raw)) {
            return "";
        }
        return raw
                .replaceAll("```[\\s\\S]*?```", " ")
                .replaceAll("!\\[[^\\]]*\\]\\([^)]*\\)", " ")
                .replaceAll("\\[([^\\]]*)\\]\\([^)]*\\)", "$1")
                .replaceAll("(?m)^#{1,6}\\s*", "")
                .replaceAll("[*_>`~#]", " ")
                .replaceAll("\\s+", " ")
                .trim();
    }

    private String tagsText(List<TagVO> tags) {
        if (tags == null || tags.isEmpty()) {
            return "";
        }
        return tags.stream()
                .map(tag -> "#" + tag.getName())
                .collect(Collectors.joining("    "));
    }

    /** 选择可显示中文的字体族；物理字体都不可用时回退逻辑字体 Serif（JDK 会做缺字回退） */
    private static String resolveFontFamily() {
        try {
            Set<String> families = new HashSet<>(Arrays.asList(
                    GraphicsEnvironment.getLocalGraphicsEnvironment().getAvailableFontFamilyNames()));
            for (String candidate : List.of("Noto Sans CJK SC", "Noto Sans CJK",
                    "Source Han Sans SC", "Microsoft YaHei", "PingFang SC",
                    "WenQuanYi Micro Hei", "SimHei", "SimSun")) {
                if (families.contains(candidate) && canDisplayChinese(candidate)) {
                    return candidate;
                }
            }
        } catch (Exception e) {
            // headless 环境异常时回退逻辑字体
        }
        return Font.SERIF;
    }

    /** 校验字体是否真的包含中文字形，避免选到只有拉丁字形的同名族 */
    private static boolean canDisplayChinese(String family) {
        try {
            return new Font(family, Font.PLAIN, 24).canDisplayUpTo("中文标题") == -1;
        } catch (Exception e) {
            return false;
        }
    }
}
