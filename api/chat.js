// api/chat.js - Vercel云函数，处理火山引擎豆包API调用
import crypto from 'crypto';
import fetch from 'node-fetch';

export default async function handler(req, res) {
    // 允许跨域（适配前端访问）
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // 处理OPTIONS预检请求
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // 1. 获取前端传入的问题
        const { question } = req.body;
        if (!question) {
            return res.status(400).json({ error: "请输入有效的问题" });
        }

        // 2. 配置火山引擎密钥（替换为你的真实AK/SK）
        const AK = process.env.VOLC_AK; // 环境变量名
        const SK = process.env.VOLC_SK;
        const service = "doubao";
        const region = "cn-north-1";
        const host = "open.volcengineapi.com";
        const path = "/api/v1/chat/completions";
        const method = "POST";

        // 3. 构造豆包API请求体
        const requestBody = JSON.stringify({
            model: "doubao-pro",
            messages: [{ role: "user", content: question }],
            temperature: 0.7,
            max_tokens: 2000
        });

        // 4. 生成火山引擎签名所需参数
        const now = new Date();
        const xDate = now.toUTCString();
        const date = now.toISOString().split('T')[0].replace(/-/g, '');
        const contentSha256 = crypto.createHash('sha256').update(requestBody).digest('base64');

        // 5. 构造待签名字符串
        const canonicalRequest = [
            method,
            path,
            "",
            `content-type:application/json`,
            `host:${host}`,
            `x-content-sha256:${contentSha256}`,
            `x-date:${xDate}`,
            "",
            "content-type;host;x-content-sha256;x-date",
            contentSha256
        ].join('\n');

        // 6. 生成签名
        const credentialScope = `${date}/${region}/${service}/request`;
        const stringToSign = [
            "HMAC-SHA256",
            xDate,
            credentialScope,
            crypto.createHash('sha256').update(canonicalRequest).digest('base64')
        ].join('\n');
        const signature = crypto.createHmac('sha256', crypto.createHmac('sha256', SK).update(date).digest())
            .update(stringToSign).digest('base64');
        const authorization = `HMAC-SHA256 Credential=${AK}/${credentialScope}, SignedHeaders=content-type;host;x-content-sha256;x-date, Signature=${signature}`;

        // 7. 调用火山引擎豆包API
        const apiRes = await fetch(`https://${host}${path}`, {
            method,
            headers: {
                "Content-Type": "application/json",
                "X-Date": xDate,
                "X-Content-Sha256": contentSha256,
                "Authorization": authorization,
                "Host": host
            },
            body: requestBody
        });

        // 8. 返回结果给前端
        const data = await apiRes.json();
        return res.status(200).json(data);

    } catch (error) {
        // 捕获错误并返回
        return res.status(500).json({
            error: "云函数调用失败",
            detail: error.message
        });
    }
}
